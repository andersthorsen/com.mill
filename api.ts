import { Homey } from "homey/lib/Device";
import MillApp from "./app";

type IRequestParms = {
  homey: Homey;
  body: Record<string, string>;
  query: Record<string, string>;
};

const authenticate = async ({ homey, body }: IRequestParms): Promise<boolean> => {
  const result = await (homey.app as MillApp).authenticate(
    body.username,
    body.password
  );

  return result;
};

const clearSettings = async ({ homey }: IRequestParms): Promise<{}> => {
  (homey.app as MillApp).clear();

  return {};
};

const clearLog = async ({ homey }: IRequestParms): Promise<{}> => {
  homey.settings.set("debugLog", []);
  return {};
};

module.exports = {
  authenticate,
  clearSettings,
  clearLog,
};
