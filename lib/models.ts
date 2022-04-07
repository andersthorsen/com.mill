export interface IRequestProperties {
  timeZoneNum: string;
}

export interface IHomeList {
  homeList: IHome[];
}

export interface IRoomList {
  roomInfo: IRoomInfo[];
}

export interface IHome {
  homeId: string;
  homeName: string;
}

export interface IRoomMap {
  name: string;
  data: {
    id: string | undefined;
    homeId: string;
    homeName: string;
    name: string;
    temp: number;
    alive: boolean;
  };
}

export interface ITempSettings {
  comfortTemp: number;
  sleepTemp: number;
  awayTemp: number;
}

export interface IRoomInfoDto extends IRoomInfo {
  deviceInfo: IDeviceInfo[];
  deviceList: IDeviceInfo[];
}

export interface IRoomInfo extends ITempSettings {
  roomProgramId: string;
  avgTemp: number;
  roomId?: string;
  roomName: string;
  currentMode: number;
  programMode: number;
  sleepTemp: number;
  awayTemp: number;
  holidayTemp?: number;
  heatStatus: number;     // Heating status: 0 No 1 Yes
  isOffline: number;
}

export interface IDeviceInfo {
  heaterFlag: number;
  subDomainId: number;
  controlType: number;
  currentTemp: number;
  canChangeTemp: number;
  deviceId: number;
  deviceName: string;
  mac: string;
  deviceStatus: number;
  electricity?: number;
}

export interface IDeviceDetailInfo {
  maxTemperature: number;
  isIndependent: boolean;
  regulatorType: number;
  subDomain: string;
  isHoliday: number;
  description: string;
  holidayTemp: number;
  deviceId: number;
  deviceName: string;
  mac: string;
  limited_heating: number;  // 50 if 50% of power
  deviceStatus: number;
  times: string;
  powerStatus: number;      // Switch status: 0 No 1 Yes
  fanStatus: number;
  holidayTemp_dou: number;
  humidity: number;
  lock: number;
  power: number;            // power (Watt) of heater  
  fanStatusShow: number;
  windowStatus: number;
  electricity: number;
  timeIdentification: number;
  preHeatStatus: number;
  eco2: number;
  heatStatus: number;     // Heating status: 0 No 1 Yes
  controlType: number;
  coolingStatus: number;
  success: boolean;
  isOffline: number;
  currentTemp: number;
}

export type Query = ({ homeId: string } | { roomId: string } | { deviceId: number }) &
  IRequestProperties;

export type ProgramMode =
  | "Comfort"
  | "Sleep"
  | "Away"
  | "Holiday"
  | "Off"
  | "Unknown"
  | "Program";

export class Room implements IRoomInfo {
  currentMode: number;
  programMode: number;
  comfortTemp: number;
  awayTemp: number;
  holidayTemp?: number;
  sleepTemp: number;
  heatStatus: number;
  avgTemp: number;
  roomId?: string | undefined;
  roomName: string;
  isOffline: number;
  roomProgramId: string;
  power?: number;
  devices: { device: IDeviceInfo; details: IDeviceDetailInfo; }[];

  constructor(room: IRoomInfo, devices: { device: IDeviceInfo, details: IDeviceDetailInfo }[]) {
    this.currentMode = room.currentMode;
    this.programMode = room.programMode;
    this.awayTemp = room.awayTemp;
    this.sleepTemp = room.sleepTemp;
    this.heatStatus = room.heatStatus;
    this.comfortTemp = room.comfortTemp;
    this.holidayTemp = room.holidayTemp;
    this.avgTemp = room.avgTemp;
    this.roomId = room.roomId;
    this.roomName = room.roomName;
    this.isOffline = room.isOffline;
    this.roomProgramId = room.roomProgramId;
    this.devices = devices || []; 

    this.power = undefined;

    for (const dev of this.devices) {
      if (dev.details.power !== undefined && dev.details.power !== null && dev.details.heatStatus === 1) {
        this.power = (this.power ?? 0) + (dev.details.power * ((dev.details.limited_heating??100)/100));
      }
    }
  }

  static validateRoom(room: IRoomInfo) {
    return room.programMode && room.roomId;
  }

  get mode(): number {
    return this.currentMode > 0 ? this.currentMode : this.programMode;
  }

  set mode(mode) {
    if (mode >= 0 && mode <= 5) {
      this.currentMode = mode;
    }
  }

  get modeName(): ProgramMode {
    switch (this.mode) {
      case 0:
        return "Program";
      case 1:
        return "Comfort";
      case 2:
        return "Sleep";
      case 3:
        return "Away";
      case 4:
        return "Holiday";
      case 5:
        return "Off";
      default:
        return "Unknown";
    }
  }

  set modeName(name: ProgramMode) {
    switch (name) {
      case "Program":
        this.currentMode = 0;
        break;
      case "Comfort":
        this.currentMode = 1;
        break;
      case "Sleep":
        this.currentMode = 2;
        break;
      case "Away":
        this.currentMode = 3;
        break;
      case "Holiday":
        this.currentMode = 4;
        break;
      case "Off":
        this.currentMode = 5;
        break;
      default:
        break;
    }
  }

  get targetTemp(): number | undefined {
    switch (this.mode) {
      case 1:
        return this.comfortTemp;
      case 2:
        return this.sleepTemp;
      case 3:
        return this.awayTemp;
      case 4:
        return this.holidayTemp;
      case 5:
        return 0;
      default:
        return 0;
    }
  }

  set targetTemp(temp) {
    switch (this.mode) {
      case 1:
        if (!temp) throw new Error("Target temperature cannot be undefined");

        this.comfortTemp = temp;
        break;
      case 2:
        if (!temp) throw new Error("Target temperature cannot be undefined");

        this.sleepTemp = temp;
        break;
      case 3:
        if (!temp) throw new Error("Target temperature cannot be undefined");

        this.awayTemp = temp;
        break;
      case 4:
        if (!temp) throw new Error("Target temperature cannot be undefined");

        this.holidayTemp = temp;
        break;
      default:
        break;
    }
  }

  get isHeating() {
    return this.heatStatus === 1;
  }

  modesMatch(room: { currentMode: number; programMode: number }) {
    return (
      this.currentMode === room.currentMode &&
      this.programMode === room.programMode
    );
  }
}
