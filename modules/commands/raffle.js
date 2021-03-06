/**
 * This file is part of Stevelabs.
 *
 * @copyright (c) 2020, Steve Guidetti, https://github.com/stevotvr
 * @license MIT
 *
 * For full license information, see the LICENSE.txt file included with the source.
 */

'use strict';

/**
 * Provides the raffle commands.
 */
export default class RaffleCommand {

  /**
   * Constructor.
   *
   * @param {Commands} commands The main command module
   */
  constructor(commands) {
    this.app = commands.app;

    commands.raffle = this.raffle;
    commands.startraffle = this.startraffle;
    commands.endraffle = this.endraffle;
  }

  async raffle(user, args = []) {
    if (!this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.app.db.run('UPDATE users SET raffle = 1 WHERE userId = ?', [ user.userId ], (err) => {
      if (err) {
        console.warn('error saving raffle data');
        console.log(err);

        return;
      } else {
        this.app.chatbot.say(args.join(' '));
      }
    });
  }

  async startraffle(user, args = []) {
    if (this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.app.db.get('UPDATE users SET raffle = 0', (err) => {
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

  async endraffle(user, args = []) {
    if (!this.app.settings.raffle_active) {
      throw 'raffle not active';
    }

    this.app.db.get('SELECT displayName FROM users WHERE raffle > 0 ORDER BY RANDOM() LIMIT 1', (err, row) => {
      if (err) {
        console.warn('error retrieving raffle data');
        console.log(err);

        return;
      } else {
        this.app.settings.raffle_active = false;
        this.app.saveSettings();

        this.app.http.sendAlert('rafflewinner', { user: row.displayName });
        this.app.chatbot.say(row ? args.join(' ').replace('${winner}', row.displayName) : '');
      }
    });
  }
}
