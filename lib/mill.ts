import crypto from 'crypto';
import { Room, IRoomInfo, ITempSettings, IHome, IHomeList, IRequestProperties, Query, IRoomList, IDeviceInfo, IDeviceDetailInfo, IRoomInfoDto } from './models';
import { fetchJSON } from './util';

const TOKEN_SAFE_ZONE = 5 * 60 * 1000;

export default class Mill {
  nonce: any;
  authEndpoint: string;
  endpoint: string;
  timeZoneNum: string;
  auth: { token: string; tokenExpire: Date; refreshToken: string; refreshTokenExpire: Date; } | null;
  user: any;
  constructor() {
    this.authEndpoint = 'https://eurouter.ablecloud.cn:9005/zc-account/v1';
    this.endpoint = 'https://eurouter.ablecloud.cn:9005/millService/v1';
    this.user = null;
    this.auth = null;
    this.nonce = 'AQcDfGrE34DfGdsV';
    this.timeZoneNum = '+02:00';
  }

  async login(username: string, password: string): Promise<any> {
    const body = JSON.stringify({
      account: username,
      password
    });

    const headers = {
      'Content-Type': 'application/x-zc-object',
      'Connection': 'Keep-Alive',
      'X-Zc-Major-Domain': 'seanywell',
      'X-Zc-Msg-Name': 'millService',
      'X-Zc-Sub-Domain': 'milltype',
      'X-Zc-Seq-Id': '1',
      'X-Zc-Version': '1',
    };

    const endpoint = `${this.authEndpoint}/login`;
    const json = await fetchJSON(endpoint, { method: 'POST', body, headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      this.user = json;
      this.auth = {
        token: json.token,
        tokenExpire: new Date(json.tokenExpire),
        refreshToken: json.refreshToken,
        refreshTokenExpire: new Date(json.refreshTokenExpire)
      };
      return json;
    }
  }

  async updateAccessToken() {
    const bodyStr = '{}';
    const bodyLen = bodyStr.length;
    const timeout = 300;
    const timestamp = (new Date().getTime() / 1000).toFixed();
    const signature = timeout + timestamp + this.nonce + this.auth?.refreshToken;
    const shaSignature = crypto.createHash('sha1').update(signature).digest('hex');

    const headers = {
      'Content-Type': 'application/x-zc-object',
      'Connection': 'Keep-Alive',
      'X-Zc-Major-Domain': 'seanywell',
      'X-Zc-Start-Time': timestamp,
      'X-Zc-Version': '1',
      'X-Zc-Timestamp': timestamp,
      'X-Zc-Timeout': `${timeout}`,
      'X-Zc-Nonce': this.nonce,
      'X-Zc-User-Id': this.user.userId,
      'X-Zc-User-Signature': shaSignature,
      'X-Zc-Content-Length': `${bodyLen}`,
    };

    const endpoint = `${this.authEndpoint}/updateAccessToken`;
    const json = await fetchJSON(endpoint, { method: 'POST', body: bodyStr, headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      this.auth = {
        token: json.token,
        tokenExpire: new Date(json.tokenExpire),
        refreshToken: json.refreshToken,
        refreshTokenExpire: new Date(json.refreshTokenExpire)
      };
    }
  }

  async validateAccessTokens() {
    const now = new Date();
    const tokenExpiration = (this.auth?.tokenExpire.getTime() || now.getTime()) - now.getTime();

    if (tokenExpiration < TOKEN_SAFE_ZONE) {
      await this.updateAccessToken();
    }
  }

  async request(command: string, body?: (IRoomInfo & IRequestProperties) | (IHome & IRequestProperties) | Query | ITempSettings | undefined) {
    const bodyStr = JSON.stringify(body || {});
    const bodyLen = bodyStr.length;
    const timeout = 300;
    const timestamp = (new Date().getTime() / 1000).toFixed();
    const signature = timeout + timestamp + this.nonce + this.auth?.token;
    const shaSignature = crypto.createHash('sha1').update(signature).digest('hex');

    const headers = {
      'Content-Type': 'application/x-zc-object',
      'Connection': 'Keep-Alive',
      'X-Zc-Major-Domain': 'seanywell',
      'X-Zc-Msg-Name': 'millService',
      'X-Zc-Sub-Domain': 'milltype',
      'X-Zc-Seq-Id': '1',
      'X-Zc-Version': '1',
      'X-Zc-Timestamp': timestamp,
      'X-Zc-Timeout': `${timeout}`,
      'X-Zc-Nonce': this.nonce,
      'X-Zc-User-Id': this.user.userId,
      'X-Zc-User-Signature': shaSignature,
      'X-Zc-Content-Length': `${bodyLen}`,
    };

    await this.validateAccessTokens();

    const endpoint = `${this.endpoint}/${command}`;
    const json = await fetchJSON(endpoint, { method: 'POST', body: bodyStr, headers });
    if (json.error) {
      throw new Error(json.error);
    } else {
      return json;
    }
  }

  // returns a list of homes
  async listHomes(): Promise<IHomeList> {
    return await this.request('selectHomeList') as IHomeList;
  }

  // returns a list of rooms in a house
  async listRooms(homeId: string): Promise<IRoomList> {
    return await this.request('selectRoombyHome', { homeId, timeZoneNum: this.timeZoneNum }) as IRoomList;
  }

  // returns a list of devices in a room
  async listDevices(roomId: string) {
    const room: { timeIdentification: number, roomInfo: IRoomInfoDto } = await this.request('selectDevicebyRoom2020', { roomId, timeZoneNum: this.timeZoneNum });
    
    console.log(room.roomInfo);

    if (!Room.validateRoom(room.roomInfo)) {
      throw new Error(`Invalid respons from Mill API: ${JSON.stringify(room)}`);
    }

    const devices: { device: IDeviceInfo, details: IDeviceDetailInfo }[] = [];

    for(const dev of (room.roomInfo.deviceList || room.roomInfo.deviceInfo || [])) {
      const details = await this.getDevice(dev.deviceId);

      //console.log(details);

      devices.push({device: dev, details: details});
    }

    return new Room(room.roomInfo, devices);
  }

  async getDevice(deviceId: number) {
    
    const device: IDeviceDetailInfo = await this.request('selectDevice2020', { deviceId, timeZoneNum: this.timeZoneNum });
    
    console.log(device);


    return device;    
  }

  async changeRoomTemperature(roomId: string, tempSettings: ITempSettings) {
    const body = {
      roomId,
      comfortTemp: tempSettings.comfortTemp,
      sleepTemp: tempSettings.sleepTemp,
      awayTemp: tempSettings.awayTemp
    };
    return this.request('changeRoomModeTempInfoAway', body);
  }

  async changeRoomMode(roomId: string, mode: number) {
    const body = {
      mode,
      roomId,
      timeZoneNum: this.timeZoneNum,
      hour: 0,
      minute: 0,
      always: (mode ? 1 : 0) // program (0) should not be an override
    };
    return this.request('changeRoomMode', body);
  }
}

module.exports = Mill;