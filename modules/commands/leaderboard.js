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
 * Provides the leaderboard commands.
 */
export default class LeaderboardCommand {

  /**
   * Constructor.
   *
   * @param {Commands} commands The main command module
   */
  constructor(commands) {
    this.app = commands.app;

    commands.leaderboard = this.leaderboard;
    commands.rank = this.rank;
    commands.ignore = this.ignore;
  }

  async leaderboard(user, args = []) {
    const count = (args.length > 0 && args[0].match(/\d+/)) ? Math.min(25, Math.max(5, args[0])) : 5;
    this.app.db.all('SELECT displayName FROM users WHERE ignoreStats = 0 ORDER BY chats + trivia * 10 DESC LIMIT ?', count, (err, rows) => {
      if (err) {
        console.warn('error getting leaderboard data');
        console.log(err);

        return;
      }

      const names = rows.map((e) => e.displayName);
      this.app.chatbot.say(`/me Top ${count} users: ${names.join(', ')}.`);
    });
  }

  async rank(user, args = []) {
    const target = args[0] ? args[0] : (user ? user.displayName : null);
    if (target === null) {
      return;
    }

    this.app.db.get('SELECT COUNT(id) AS rank FROM users WHERE ignoreStats = 0 AND chats + trivia * 10 >= (SELECT chats + trivia * 10 FROM users WHERE ignoreStats = 0 AND userName = ?)', [ target.toLowerCase() ], (err, row) => {
      if (err) {
        console.warn('error getting leaderboard rank data');
        console.log(err);

        return;
      }

      if (!row || row.rank < 1) {
        return;
      }

      if (args[0]) {
        this.app.chatbot.say(`/me User ${target} is ranked #${row.rank}.`);
      } else {
        this.app.chatbot.say(`@${target} You are ranked #${row.rank}.`);
      }
    });
  }

  async ignore(user, args = []) {
    if (args.length < 2) {
      return;
    }

    const target = args[0].toLowerCase();
    const value = args[1] !== '0';
    const chatbot = this.app.chatbot;
    this.app.db.run('UPDATE users SET ignoreStats = ? WHERE userName = ?', [ value, target.toLowerCase() ], function (err) {
      if (err) {
        console.warn('error updating stats ignore status');
        console.log(err);

        return;
      }

      if (this.changes > 0) {
        chatbot.say(`${user ? `@${user.displayName} ` : ''}Set ${target}'s stats status to ${value ? '' : 'not '}ignored.`)
      }
    });
  }
}
