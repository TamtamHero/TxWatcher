import teleBot from 'telebot';
import { ethers } from 'ethers';
import level from 'level';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const bot = new teleBot(config.telegram_token);
const db = {};
const disk_db = level('db/level.db');

function add_new_address(chat_id: number, msg: string) {
  const addr = msg.toLowerCase();
  if (addr in db && db[addr].includes(chat_id)) {
    bot.sendMessage(chat_id, 'This address is already monitored');
  } else {
    const watchers = addr in db ? db[addr] : [];
    watchers.push(chat_id);

    disk_db.put(addr, watchers, (err) => {
      if (err) {
        throw err;
      } else {
        db[addr] = watchers;
        bot.sendMessage(chat_id, `${addr} has been added to the list of monitored addres.`);
      }
    });
  }
}

function rm_address(chat_id: number, msg: string) {
  const addr = msg.split(' ')[1].toLowerCase();
  if (addr in db && db[addr].includes(chat_id)) {
    const watchers = db[addr].filter((item) => item != chat_id);
    if (watchers.length == 0) {
      disk_db.del(addr, (err) => {
        if (err) {
          throw err;
        } else {
          delete db[addr];
        }
      });
    } else {
      disk_db.put(addr, watchers, (err) => {
        if (err) {
          throw err;
        }
        db[addr] = watchers;
      });
    }
    bot.sendMessage(chat_id, `${addr} has been removed from the list of monitored address.`);
  } else {
    bot.sendMessage(chat_id, 'This address is not monitored.');
  }
}

function handle(msg) {
  if (msg.text.startsWith('0x')) {
    add_new_address(msg.from.id, msg.text);
  } else if (msg.text.startsWith('del ')) {
    rm_address(msg.from.id, msg.text);
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
          if (src in db) {
            const chat_ids = db[src];
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

disk_db
  .createReadStream()
  .on('data', function (data) {
    db[data.key] = data.value.split(',').map((e) => Number(e));
  })
  .on('error', function (err) {
    console.log('Error streaming db:', err);
  })
  .on('close', function () {
    console.log('Stream closed');
  })
  .on('end', function () {
    console.log('Stream ended');
  });

bot.on('text', (msg) => handle(msg));

bot.start();

monitoring_loop(6000);
