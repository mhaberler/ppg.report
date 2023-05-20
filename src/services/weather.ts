import axios from "axios";
import { addSeconds } from "date-fns";
import {
  Alerts,
  Discussion,
  Property,
  Value,
  Weather,
} from "../features/weather/weatherSlice";
import { parse, toSeconds } from "iso8601-duration";
import axiosRetryEnhancer from "axios-retry";
import { isWithinInterval } from "../helpers/date";

const axiosRetry = axios.create();

/**
 * "The gridpoints endpoint returns a 500 error. Retrying the request generally returns valid data."
 *
 * https://www.weather.gov/documentation/services-web-api#/default/alerts_active_zone
 */
axiosRetryEnhancer(axiosRetry, {
  retries: 5,
  retryCondition: (error) =>
    !!(
      error.response?.status &&
      error.response?.status >= 500 &&
      error.response?.status < 600
    ),
});

export async function getGridData(
  forecastGridDataUrl: string
): Promise<Weather> {
  let { data } = await axiosRetry.get(forecastGridDataUrl);

  return data;
}

export async function getAlerts({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}): Promise<Alerts> {
  const { data } = await axios.get<Alerts>(`/api/weather/alerts/active`, {
    params: {
      point: `${lat},${lon}`,
      message_type: "alert",
      status: "actual",
    },
  });

  // Hack for https://github.com/weather-gov/api/discussions/573
  data.features = data.features.filter(
    (feature) =>
      !data.features.find(
        (potentialNewerFeature) =>
          potentialNewerFeature.properties.event === feature.properties.event &&
          Date.parse(potentialNewerFeature.properties.sent) >
            Date.parse(feature.properties.sent)
      )
  );

  return data;
}

export async function getPointResources({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}): Promise<{ forecastGridDataUrl: string; timeZone: string }> {
  let { data } = await axios.get(`/api/weather/points/${lat},${lon}`);

  const forecastGridDataUrl = data.properties.forecastGridData;

  if (!forecastGridDataUrl)
    throw new Error("forecastGridData not defined in response!");

  return {
    forecastGridDataUrl: normalize(data.properties.forecastGridData),
    timeZone: data.properties.timeZone,
  };
}

export async function getDiscussion(gridId: string): Promise<Discussion> {
  let { data: discussionsData } = await axios.get(
    `/api/weather/products/types/AFD/locations/${gridId}`
  );

  const discussionUrl = normalize(discussionsData["@graph"][0]["@id"]);

  let { data } = await axios.get(discussionUrl);

  return data;
}

/**
 * @param url NOAA url, like https://api.weather.gov/points
 * @returns Relative url, like /api/weather/points
 */
function normalize(url: string): string {
  const { pathname } = new URL(url);

  return `/api/weather${pathname}`;
}

export function findValue<T>(
  date: Date,
  property: Property<T>
): Value<T> | undefined {
  return property.values.find(({ validTime }) =>
    isBetweenWxTime(validTime, date)
  );
}

function isBetweenWxTime(weatherInterval: string, date: Date): boolean {
  const [start, duration] = weatherInterval.split("/");

  // End should be exclusive, so minus 1 second
  const end = addSeconds(new Date(start), toSeconds(parse(duration)) - 1);

  return isWithinInterval(date, { start: new Date(start), end });
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  lwrTerm: string;
}

/**
 * Some terms generate large amounts of false positives and/or are layman terms
 */
const blacklist: Record<Lowercase<string>, true> = {
  weather: true,
  track: true,
  forecast: true,
  few: true,
  cloud: true,
  temperature: true,
  high: true,
  low: true,
  pressure: true,
  center: true,
  as: true,
  air: true,
  cdt: true,
  pdt: true,
  edt: true,
  mdt: true,
  mid: true,
  rain: true,
  chance: true,
  night: true,
  temps: true,
  shower: true,
  wind: true,
  same: true,
  range: true,
  day: true,
  precipitation: true,
};

export async function getGlossary(): Promise<GlossaryTerm[]> {
  let { data } = await axios.get("/api/weather/glossary");

  return (data.glossary as GlossaryTerm[])
    .filter(
      ({ term }) =>
        !!term &&
        term.length > 1 &&
        !blacklist[term.toLowerCase() as Lowercase<string>]
    )
    .map((item) => ({ ...item, lwrTerm: item.term.toLowerCase() }))
    .sort((a, b) => b.term.length - a.term.length);
}
