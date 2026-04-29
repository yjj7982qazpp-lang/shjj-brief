const CF_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return dateText(date);
}

function emptyMetrics(status = "pending", message = "분석 데이터 연동 대기") {
  return {
    status,
    message,
    views: {
      today: null,
      last_7_days: null,
      last_30_days: null,
    },
    visitors: {
      today: null,
      last_7_days: null,
      last_30_days: null,
    },
  };
}

function sumGroups(groups, startDate) {
  return groups
    .filter((group) => group?.dimensions?.date >= startDate)
    .reduce(
      (acc, group) => {
        acc.views += Number(group?.sum?.pageViews || group?.sum?.requests || 0);
        acc.visitors += Number(group?.uniq?.uniques || 0);
        return acc;
      },
      { views: 0, visitors: 0 }
    );
}

async function fetchZoneAnalytics(env) {
  const query = `
    query ZoneAnalytics($zoneTag: string, $dateStart: string, $dateEnd: string) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 31
            filter: { date_geq: $dateStart, date_leq: $dateEnd }
          ) {
            dimensions {
              date
            }
            sum {
              pageViews
              requests
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;
  const response = await fetch(CF_GRAPHQL_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        zoneTag: env.CLOUDFLARE_ZONE_ID,
        dateStart: daysAgo(29),
        dateEnd: daysAgo(0),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare analytics request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error("Cloudflare analytics query failed");
  }

  const groups = payload.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  const today = sumGroups(groups, daysAgo(0));
  const week = sumGroups(groups, daysAgo(6));
  const month = sumGroups(groups, daysAgo(29));

  return {
    status: "ready",
    message: "분석 데이터 연동 완료",
    views: {
      today: today.views,
      last_7_days: week.views,
      last_30_days: month.views,
    },
    visitors: {
      today: today.visitors,
      last_7_days: week.visitors,
      last_30_days: month.visitors,
    },
  };
}

export async function onRequestGet({ env }) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    return jsonResponse(emptyMetrics());
  }

  if (!env.CLOUDFLARE_ZONE_ID) {
    return jsonResponse(emptyMetrics("pending", "CLOUDFLARE_ZONE_ID 설정 대기"));
  }

  try {
    return jsonResponse(await fetchZoneAnalytics(env));
  } catch {
    return jsonResponse(emptyMetrics("pending", "분석 데이터 연동 대기"));
  }
}
