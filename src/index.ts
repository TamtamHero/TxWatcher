import teleBot from 'telebot';
import { ethers } from 'ethers';
import level from 'level';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const bot = new teleBot(config.telegram_token);
const watchlist = {};
const watchlist_db = level('db/watchlist.db');
const stats = {};

function add_new_address(chat_id: number, msg: string) {
  const addr = msg.toLowerCase();
  if (addr in watchlist && watchlist[addr].includes(chat_id)) {
    bot.sendMessage(chat_id, 'This address is already monitored');
  } else {
    if (chat_id in stats['watchers'] && stats['watchers'][chat_id] >= config['MAX_ADDRESS_MONITORED']) {
      bot.sendMessage(chat_id, `You are already monitoring ${stats['watchers']} addresses (max).\nPlease 🗑 some.`);
    } else {
      const watchers = addr in watchlist ? watchlist[addr] : [];
      watchers.push(chat_id);

      watchlist_db.put(addr, watchers, (err) => {
        if (err) {
          throw err;
        } else {
          watchlist[addr] = watchers;
          stats['watchers'][chat_id] = chat_id in stats['watchers'] ? stats['watchers'][chat_id] : 1;
          bot.sendMessage(chat_id, `${addr} has been added to the list of monitored addres.`);
        }
      });
    }
  }
}

function rm_address(chat_id: number, msg: string) {
  const addr = msg.split(' ')[1].toLowerCase();
  if (addr in watchlist && watchlist[addr].includes(chat_id)) {
    const watchers = watchlist[addr].filter((item) => item != chat_id);
    if (watchers.length == 0) {
      watchlist_db.del(addr, (err) => {
        if (err) {
          throw err;
        } else {
          delete watchlist[addr];
        }
      });
    } else {
      watchlist_db.put(addr, watchers, (err) => {
        if (err) {
          throw err;
        }
        watchlist[addr] = watchers;
      });
    }
    stats['watchers'][chat_id] -= 1;
    if (stats['watchers'][chat_id] <= 0) {
      delete stats['watchers'][chat_id];
    }
    bot.sendMessage(chat_id, `${addr} has been removed from the list of monitored address.`);
  } else {
    bot.sendMessage(chat_id, 'This address is not monitored.');
  }
}

function get_stats(chat_id: number, msg: string) {
  do_stats();
  if (msg.includes('full')) {
    bot.sendMessage(chat_id, `📊\n${JSON.stringify(stats)}`);
  } else {
    bot.sendMessage(
      chat_id,
      `📊\ntotal_users: ${stats['total_users']}\ntotal_address: ${stats['total_address']}\ntotal_addresses_watched: ${stats['total_addresses_watched']}`
    );
  }
}

function handle(msg) {
  if (msg.text.startsWith('0x')) {
    add_new_address(msg.from.id, msg.text);
  } else if (msg.text.startsWith('del ')) {
    rm_address(msg.from.id, msg.text);
  } else if (msg.text.startsWith('stats')) {
    get_stats(msg.from.id, msg.text);
  } else {
    bot.sendMessage(
      msg.from.id,
      'To start monitoring an address, just send it to me:\n👀 `0x1234Whatever`\nTo remove an address from your watchlist:\n🗑 `del 0x1234Whatever`',
      { parseMode: 'MarkdownV2' }
    );
  }
}

async function monitoring_loop(frequency: number) {
  const web3 = new ethers.providers.JsonRpcProvider(config.eth_RPC);
  let previous_block = await web3.getBlockNumber();
  let last_block = previous_block;

  for (;;) {
    try {
      while (previous_block == last_block) {
        await new Promise((r) => setTimeout(r, frequency));
        last_block = await web3.getBlockNumber();
      }

      for (let i = previous_block + 1; i < last_block + 1; i++) {
        const block = await web3.getBlockWithTransactions(i);
        console.log(i);

        for (const tx of block.transactions) {
          const src = tx.from.toLowerCase();
          if (src in watchlist) {
            const chat_ids = watchlist[src];
            chat_ids.map((chat_id) =>
              bot.sendMessage(chat_id, `https://etherscan.io/tx/${tx['hash']} has confirmed for address ${src}`)
            );
          }
        }
      }

      previous_block = last_block;
    } catch (error) {
      console.log(error);
    }
  }
}

// Count number of address watched per user, and other things
function do_stats() {
  stats['watchers'] = {};
  stats['total_addresses_watched'] = 0;
  for (const addr in watchlist) {
    watchlist[addr].map((chat_id) => {
      chat_id in stats['watchers'] ? (stats['watchers'][chat_id] += 1) : (stats['watchers'][chat_id] = 1);
      if (stats['watchers'][chat_id] > config['MAX_ADDRESS_MONITORED'])
        throw `Error: user ${chat_id} has at least ${stats['watchers'][chat_id]} registered addresses.`;
    });
    stats['total_addresses_watched'] += watchlist[addr].length;
  }
  stats['total_address'] = Object.keys(watchlist).length;
  stats['total_users'] = Object.keys(stats['watchers']).length;
}

function init() {
  watchlist_db
    .createReadStream()
    .on('data', function (data) {
      watchlist[data.key] = data.value.split(',').map((e) => Number(e));
    })
    .on('error', function (err) {
      console.log('Error streaming watchlist db:', err);
    })
    .on('close', function () {
      console.log('Watchlist loaded successfully');
      do_stats();
    });
}

init();

bot.on('text', (msg) => handle(msg));

bot.start();

monitoring_loop(6000);
