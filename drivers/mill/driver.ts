import { Driver } from 'homey';
import MillApp from '../../app';
import { IRoomMap } from '../../lib/models';
import { debug as _debug } from './../../lib/util';

export default class MillDriver extends Driver {
  app: MillApp | undefined;
  async onInit() {
    this.app = this.app ?? this.homey?.app as MillApp;
  }

  async onPairListDevices(): Promise<IRoomMap[][]> {
    if (!this.app?.isConnected()) {
      // eslint-disable-next-line no-underscore-dangle
      this.debug('Unable to pair, not authenticated');
      throw new Error(this.homey.__('pair.messages.notAuthorized'));      
    } else {
      this.debug('Pairing');
      const millApi = this.app.getMillApi();
      const homes = await millApi?.listHomes();
      this.debug(`Found following homes: ${homes.homeList.map(home => `${home.homeName} (${home.homeId})`).join(', ')}`);

      const rooms = await Promise.all(homes.homeList.map(async (home) => {
        const rooms = await millApi?.listRooms(home.homeId);
        this.debug(`Found following rooms in ${home.homeName}: ${rooms.roomInfo.map(room => `${room.roomName} (${room.roomId})`).join(', ')}`);

        return rooms.roomInfo.map((room) => (
          {
            name: room.roomName,
            data: {
              id: room.roomId,
              homeId: homes.homeList[0].homeId,
              homeName: homes.homeList[0].homeName,
              name: room.roomName,
              temp: room.avgTemp,
              alive: room.isOffline === 1
            }
          }
        ));
      }));
      return ([] as IRoomMap[][]).concat.apply([], rooms);
    }
  }

  debug (message: string, data?: any) {
    _debug(message, data, this.homey);
  }
}

module.exports = MillDriver;