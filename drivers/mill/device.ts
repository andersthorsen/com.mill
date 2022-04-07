import {
  FlowCardAction,
  FlowCardCondition,
  FlowCardTriggerDevice,
} from "homey";
import { Device } from "homey";
import MillApp from "../../app";
import { Log } from "../../lib/log";
import { ProgramMode, Room } from "../../lib/models";

// eslint-disable-next-line import/no-unresolved
const Homey = require("homey");
import { debug as _debug, error as _error } from "../../lib/util";

class MillDevice extends Device {
  deviceId: any;
  logger: Log | undefined;
  modeChangedTrigger: FlowCardTriggerDevice | undefined;
  modeChangedToTrigger: FlowCardTriggerDevice | undefined;
  isHeatingCondition: FlowCardCondition | undefined;
  isMatchingModeCondition: FlowCardCondition | undefined;
  setProgramAction: FlowCardAction | undefined;
  room: Room | undefined;
  refreshTimeout: NodeJS.Timeout | null = null;

  async onInit() {
    this.deviceId = this.getData().id;
    this.logger = new Log(this.homey ?? Homey);

    this.debug(
      `[${this.getName()}] ${this.getClass()} (${this.deviceId}) initialized`
    );

    // Add new capailities for devices that don't have them yet
    if (!this.hasCapability("onoff")) {
      try {
        await this.addCapability("onoff");
      } catch (err) {
        this.error("adding onoff cabability failed", err);
      }
    }
    if (!this.hasCapability("measure_power")) {
      try {
        await this.addCapability("measure_power");
      } catch (err) {
        this.error("adding measure_power cabability failed", err);
      }
    }

    // capabilities
    this.registerCapabilityListener(
      "target_temperature",
      this.onCapabilityTargetTemperature.bind(this)
    );
    this.registerCapabilityListener(
      "mill_mode",
      this.onCapabilityThermostatMode.bind(this)
    );
    this.registerCapabilityListener("onoff", this.onCapabilityOnOff.bind(this));

    // triggers
    this.modeChangedTrigger =
      this.homey.flow.getTriggerCard("mill_mode_changed");

    this.modeChangedToTrigger = this.homey.flow.getTriggerCard(
      "mill_mode_changed_to"
    );
    this.modeChangedToTrigger.registerRunListener(
      (args, state) => args.mill_mode === state.mill_mode
    );

    // conditions
    this.isHeatingCondition =
      this.homey.flow.getConditionCard("mill_is_heating");
    this.isHeatingCondition.registerRunListener(
      () => this.room && this.room.heatStatus === 1
    );

    this.isMatchingModeCondition =
      this.homey.flow.getConditionCard("mill_mode_matching");
    this.isMatchingModeCondition.registerRunListener(
      (args) => args.mill_mode === this.room?.modeName
    );

    // actions
    this.setProgramAction = this.homey.flow.getActionCard("mill_set_mode");
    this.setProgramAction.registerRunListener((args) => {
      this.debug(
        `[${args.device.getName()}] Flow changed mode to ${args.mill_mode}`
      );
      return args.device.setThermostatMode(args.mill_mode);
    });

    this.refreshTimeout = null;
    await this.refreshState();
  }

  async refreshState() {
    this.debug(`[${this.getName()}] Refreshing state`);

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    try {
      if ((this.homey.app as MillApp).isConnected()) {
        await this.refreshMillService();
        this.setAvailable();
      } else {
        this.debug(`[${this.getName()}] Mill not connected`);
        this.setUnavailable();
        try {
          await (this.homey.app as MillApp).connectToMill();

          this.scheduleRefresh(10);
        } catch (err) {
          this.error("Error caught while refreshing state", err);
        }
      }
    } catch (e) {
      this.error("Exception caught", e);
      this.logger?.captureException(e);
    } finally {
      if (this.refreshTimeout === null) {
        this.scheduleRefresh();
      }
    }
  }

  scheduleRefresh(interval?: number): void {
    const refreshInterval =
      interval || this.homey.settings.get("interval") || 10;

    this.refreshTimeout = setTimeout(
      this.refreshState.bind(this),
      refreshInterval * 1000
    );
    this.debug(
      `[${this.getName()}] Next refresh in ${refreshInterval} seconds`
    );
  }

  async refreshMillService() {
    const millApi = (this.homey.app as MillApp).getMillApi();

    try {
      var room = await millApi.listDevices(this.getData().id);

      //this.debug(`[${this.getName()}] Mill state refreshed`, room);

      this.debug(`[${this.getName()}] Mill state refreshed`, {
        comfortTemp: room.comfortTemp,
        awayTemp: room.awayTemp,
        holidayTemp: room.holidayTemp,
        sleepTemp: room.sleepTemp,
        avgTemp: room.avgTemp,
        currentMode: room.currentMode,
        programMode: room.programMode,
        heatStatus: room.heatStatus,
      });

      console.log("program mode:" + room.programMode);

      if (room.programMode !== undefined) {
        if (
          this.room &&
          !this.room.modesMatch(room) &&
          this.room.modeName !== room.modeName
        ) {
          this.debug(
            `[${this.getName()}] Triggering mode change from ${
              this.room.modeName
            } to ${room.modeName}`
          );
          // not needed, setCapabilityValue will trigger
          // this.modeChangedTrigger.trigger(this, { mill_mode: room.modeName })
          //   .catch(this.error);
          try {
            await this.modeChangedToTrigger?.trigger(this, undefined, {
              mill_mode: room.modeName,
            });
          } catch (err) {
            this.error('error when triggering mode changed', err);
          }
        }

        this.room = new Room(room, room.devices);
        const jobs = [
          this.setCapabilityValue(
            "measure_temperature",
            (Math.log10(
              (room.avgTemp ^ (room.avgTemp >> 31)) - (room.avgTemp >> 31)
            ) |
              0) +
              1 >
              2
              ? Math.round(room.avgTemp / 100)
              : room.avgTemp
          ),
          this.setCapabilityValue("mill_mode", room.modeName),
          this.setCapabilityValue("mill_onoff", room.isHeating),
          this.setCapabilityValue("onoff", room.modeName !== "Off"),
        ];

        if (this.hasCapability("measure_power")) {
          console.log("power usage: ", room.power);

          if (room.power !== null && room.power !== undefined) {
            jobs.push(
              this.setCapabilityValue("measure_power", room.power)
            );
          } else {
            const settings = this.getSettings();
            if (settings.energy_consumption > 0)
              jobs.push(
                this.setCapabilityValue(
                  "measure_power",
                  room.isHeating ? settings.energy_consumption : 2
                )
              );
          }
        }

        if (room.modeName !== "Off") {
          jobs.push(
            this.setCapabilityValue("target_temperature", room.targetTemp)
          );
        }

        try {
          await Promise.all(jobs);
        } catch (err) {
          this.logger?.captureException(err);
        }
      }
    } catch (err) {
      this.error(
        `[${this.getName()}] Error caught while refreshing state`,
        err
      );
    }
  }

  onAdded() {
    this.debug("device added", this.getState());
  }

  onDeleted() {
    if (this.refreshTimeout) clearTimeout(this.refreshTimeout);

    this.debug("device deleted", this.getState());
  }

  async onCapabilityTargetTemperature(value: number, opts: any): Promise<void> {
    const temp = Math.ceil(value);

    if (!this.room) {
      this.error(`onCapabilityTargetTemperature(${temp}) room not defined`);
      return;
    }

    try {
      this.debug(`onCapabilityTargetTemperature(${value})`);
      if (temp !== value && this.room?.modeName !== "Off") {
        // half degrees isn't supported by Mill, need to round it up
        this.setCapabilityValue("target_temperature", temp);
        this.debug(`onCapabilityTargetTemperature(${value}=>${temp})`);
      }
      const millApi = (this.homey.app as MillApp).getMillApi();
      this.room.targetTemp = temp;
      await millApi.changeRoomTemperature(this.deviceId, this.room);
      this.debug(`onCapabilityTargetTemperature(${temp}) done`);
      this.debug(
        `[${this.getName()}] Changed temp to ${temp}: currentMode: ${
          this.room.currentMode
        }/${this.room.programMode}, comfortTemp: ${
          this.room.comfortTemp
        }, awayTemp: ${this.room.awayTemp}, avgTemp: ${
          this.room.avgTemp
        }, sleepTemp: ${this.room.sleepTemp}`
      );
    } catch (err) {
      this.debug(`onCapabilityTargetTemperature(${temp}) error`);
      this.debug(
        `[${this.getName()}] Change temp to ${temp} resultet in error`,
        err
      );
    }
  }

  async setThermostatMode(value: ProgramMode) {
    if (!this.room) {
      this.error(`setThermostatMode(${value}) room not defined`);
      return;
    }

    try {
      const millApi = (this.homey.app as MillApp).getMillApi();
      if (this.room) this.room.modeName = value;

      const jobs = [];
      if (this.room?.modeName !== "Off") {
        jobs.push(
          this.setCapabilityValue("target_temperature", this.room?.targetTemp)
        );
      }
      jobs.push(millApi.changeRoomMode(this.deviceId, this.room?.currentMode));

      await Promise.all(jobs);

      this.debug(
        `[${this.getName()}] Changed mode to ${value}: currentMode: ${
          this.room?.currentMode
        }/${this.room?.programMode}, comfortTemp: ${
          this.room?.comfortTemp
        }, awayTemp: ${this.room?.awayTemp}, avgTemp: ${
          this.room?.avgTemp
        }, sleepTemp: ${this.room?.sleepTemp}`
      );
    } catch (err) {
      this.error(
        `[${this.getName()}] Change mode to ${value} resulted in error`,
        err
      );
    }
  }

  async onCapabilityThermostatMode(
    value: ProgramMode,
    opts: any
  ): Promise<void> {
    await this.setThermostatMode(value);
  }

  async onCapabilityOnOff(value: boolean, opts: any): Promise<void> {
    let mode: ProgramMode = value ? "Program" : "Off";
    await this.setThermostatMode(mode);
  }

  error(message: string, data?: any) {
    _error(message, data, this.homey);
  }

  debug(message: string, data?: any) {
    _debug(message, data, this.homey);
  }
}

module.exports = MillDevice;
