/**
 * This file is part of Stevelabs.
 *
 * @copyright (c) 2020, Steve Guidetti, https://github.com/stevotvr
 * @license MIT
 *
 * For full license information, see the LICENSE.txt file included with the source.
 */

'use strict'

export default class Commands {
  constructor(app) {
    this.app = app;
    this.db = app.db.db;
  }

  async say(user, args = []) {
    this.app.chatbot.say(args.join(' '));
  }

  async sfx(user, args = []) {
    if(!args[0] || !this.app.http.sendSfx(args[0])) {
      throw 'sound not found';
    }
  }

  async tip(user, args = []) {
    const cb = (err, row) => {
      if (err) {
        console.warn('error getting tip data');
        console.log(err);

        return;
      }

      if (row) {
        this.app.chatbot.say(`TIP #${row.id}: ${row.message}`);
      } else {
        this.app.chatbot.say(`Sorry, ${user}, we're all out of tips!`);
      }
    }

    if (args[0] && args[0].match(/\d+/)) {
      this.db.get('SELECT id, message FROM tips WHERE id = ?', args[0], cb);
    } else {
      this.db.get('SELECT id, message FROM tips ORDER BY RANDOM() LIMIT 1', cb);
    }
  }

  async addtip(user, args = []) {
    const message = args.join(' ');

    if (message.length < 2) {
      this.app.chatbot.say(`${user} Your tip message is too short (2 characters min, yours was ${message.length})`);
    } else if (message.length > 80) {
      this.app.chatbot.say(`${user} Your tip message is too long (80 characters max, yours was ${message.length})`);
    } else {
      const chatbot = this.app.chatbot;
      this.db.run('INSERT INTO tips (date, user, message) VALUES (?, ?, ?)', Date.now(), user, message, function (err) {
        if (err) {
          console.warn('error saving tip data');
          console.log(err);

          return;
        }

        chatbot.say(`Tip #${this.lastID} has been added to the list`);
      });
    }
  }

  async edittip(user, args = []) {
    if (args.length < 2 || !args[0].match(/\d+/)) {
      throw 'invalid arguments';
    }

    const message = args.slice(1).join(' ').trim();
    this.db.run('UPDATE tips SET message = ? WHERE id = ?', message, args[0], (err) => {
      if (err) {
        console.warn('error saving tip data');
        console.log(err);

        return;
      }

      this.app.chatbot.say(`Tip #${args[0]} has been edited!`);
    });
  }

  async deletetip(user, args = []) {
    if (args.length < 1 || !args[0].match(/\d+/)) {
      throw 'invalid arguments';
    }

    this.db.run('DELETE FROM tips WHERE id = ?', args[0], (err) => {
      if (err) {
        console.warn('error deleting tip data');
        console.log(err);

        return;
      }

      this.app.chatbot.say(`Tip #${args[0]} has been deleted!`);
    });
  }

  async raffle(user, args = []) {
    if (!this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.db.run('INSERT OR IGNORE INTO raffle (user) VALUES (?)', [ user ], (err) => {
      if (err) {
        console.warn('error saving raffle data');
        console.log(err);

        return;
      } else {
        this.app.chatbot.say(args.join(' '));
      }
    });
  }

  async endraffle(user, args = []) {
    if (!this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.db.get('SELECT user FROM raffle ORDER BY RANDOM() LIMIT 1', (err, row) => {
      if (err) {
        console.warn('error retrieving raffle data');
        console.log(err);

        return;
      } else {
        this.app.settings.raffle_active = false;
        this.app.saveSettings();

        this.app.http.sendAlert('rafflewinner', { user: row.user });
        this.app.chatbot.say(row ? args.join(' ').replace('${winner}', row.user) : '');
      }
    });
  }

  async startraffle(user, args = []) {
    if (this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.db.get('DELETE FROM raffle', (err) => {
      if (err) {
        console.warn('error deleting raffle data');
        console.log(err);

        return;
      } else {
        this.app.settings.raffle_active = true;
        this.app.saveSettings();

        this.app.chatbot.say(args.join(' '));
      }
    });
  }

  async quote(user, args = []) {
    const cb = (err, row) => {
      if (err) {
        console.warn('error getting quote data');
        console.log(err);

        return;
      }

      if (row) {
        const date = new Date(row.date);
        const dateString = `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`;
        const endTag = row.game ? `[${row.game}] [${dateString}]` : `[${dateString}]`;

        const message = row.message[0] === '"' ? row.message : `"${row.message}"`;
        this.app.chatbot.say(`Quote #${row.id}: ${message} ${endTag}`);
      } else {
        this.app.chatbot.say(`Sorry, ${user}, we're all out of quotes!`);
      }
    };

    if (args[0] && args[0].match(/\d+/)) {
      this.db.get('SELECT id, date, game, message FROM quotes WHERE id = ?', args[0], cb);
    } else {
      this.db.get('SELECT id, date, game, message FROM quotes ORDER BY RANDOM() LIMIT 1', cb);
    }
  }

  async addquote(user, args = []) {
    const message = args.join(' ').trim();

    if (!this.app.islive) {
      this.app.chatbot.say(`${user} You can only add a quote when the channel is live`);
    } else if (message.length < 2) {
      this.app.chatbot.say(`${user} Your quote message is too short (2 characters min, yours was ${message.length})`);
    } else {
      let game = '';
      try {
        const channel = await this.app.api.client.kraken.channels.getMyChannel();
        if (channel) {
          game = channel.game;
        }
      } catch (err) {
        console.warn('quote: error getting game info');
        console.log(err);
      }

      const chatbot = this.app.chatbot;
      this.db.run('INSERT INTO quotes (date, user, game, message) VALUES (?, ?, ?, ?)', Date.now(), user, game, message, function (err) {
        if (err) {
          console.warn('error saving quote data');
          console.log(err);

          return;
        }

        chatbot.say(`Quote #${this.lastID} has been added!`);
      });
    }
  }

  async editquote(user, args = []) {
    if (args.length < 2 || !args[0].match(/\d+/)) {
      throw 'invalid arguments';
    }

    const message = args.slice(1).join(' ').trim();
    this.db.run('UPDATE quotes SET message = ? WHERE id = ?', message, args[0], (err) => {
      if (err) {
        console.warn('error saving quote data');
        console.log(err);

        return;
      }

      this.app.chatbot.say(`Quote #${args[0]} has been edited!`);
    });
  }

  async deletequote(user, args = []) {
    if (args.length < 1 || !args[0].match(/\d+/)) {
      throw 'invalid arguments';
    }

    this.db.run('DELETE FROM quotes WHERE id = ?', args[0], (err) => {
      if (err) {
        console.warn('error deleting quote data');
        console.log(err);

        return;
      }

      this.app.chatbot.say(`Quote #${args[0]} has been deleted!`);
    });
  }

  async followage(user, args = []) {
    const target = args[0] ? args[0] : user;
    const targetUser = await this.app.api.client.kraken.users.getUserByName(target);
    if (targetUser) {
      const follow = await targetUser.getFollowTo(this.app.api.userId);
      if (follow) {
        this.app.chatbot.say(`${target} has been following since ${follow.followDate}`);
        return;
      }
    }

    this.app.chatbot.say(`${target} is not following`);
  }

  /**
   * Parse a command string.
   *
   * @param {string} command The command string
   * @param {array} params The parameters
   * @param {ChatUser} userInfo The user data of the user triggering the command
   */
  async parseCommand(command, params, userInfo) {
    let parsed = command.replace(/\$\{(\d+)(\:(\d*))?\}/g, (match, start, range, end) => {
      if (range) {
        if (end) {
          if (end >= 0) {
            end++;
          }

          return params.slice(start, end).join(' ');
        }

        return params.slice(start).join(' ');
      }

      return params[start];
    });

    const promises = [];
    parsed.replace(/\$\{([a-z][0-9a-z]*)(?: (.+?))?\}/gi, (match, fn, p) => {
      promises.push(new Promise(async (resolve) => {
        switch (fn) {
          case 'user':
            resolve(userInfo ? userInfo.displayName : 'user');
            break;
          case 'channel':
            resolve(p.toLowerCase());
            break;
          case 'game':
            if (!p) {
              resolve(this.app.api.game);
              break;
            }

            const user = await this.app.api.client.kraken.users.getUserByName(p);
            if (user) {
              const channel = await user.getChannel();
              if (channel && channel.game) {
                resolve(channel.game);
                break;
              }
            }

            resolve('unknown');
            break;
          default:
            resolve(match);
        }
      }));
    });

    const values = await Promise.all(promises);
    parsed = parsed.replace(/\$\{([a-z][0-9a-z]*)(?: (.+?))?\}/gi, () => values.shift()).split(/\s+/);
    if (!parsed.length || this[parsed[0]] === undefined) {
      throw 'command not found';
    }

    return await this[parsed[0]](userInfo ? userInfo.username : null, parsed.slice(1));
  }
}