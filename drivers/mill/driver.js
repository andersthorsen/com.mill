// eslint-disable-next-line import/no-unresolved
const Homey = require('homey');
const { debug } = require('./../../lib/util');

class MillDriver extends Homey.Driver {
  async onInit() {
  }

  async onPairListDevices(data) {
    if (!this.app.isConnected()) {
      // eslint-disable-next-line no-underscore-dangle
      debug('Unable to pair, not authenticated');
      throw new Error(this.homey.__('pair.messages.notAuthorized'));      
    } else {
      debug('Pairing');
      const millApi = this.app.getMillApi();
      const homes = await millApi.listHomes();
      debug(`Found following homes: ${homes.homeList.map(home => `${home.homeName} (${home.homeId})`).join(', ')}`);

      const rooms = await Promise.all(homes.homeList.map(async (home) => {
        const rooms = await millApi.listRooms(home.homeId);
        debug(`Found following rooms in ${home.homeName}: ${rooms.roomInfo.map(room => `${room.roomName} (${room.roomId})`).join(', ')}`);

        return rooms.roomInfo.map(room => (
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
      return [].concat.apply([], rooms);
    }
  }
}

module.exports = MillDriver;
