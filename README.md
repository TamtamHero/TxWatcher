# TxWatcher

A basic (very alpha) 🤖 that monitors newly confirmed Ethereum transactions for a set of addresses inputed by the client.

# But why ser ?

- If you're ~~a cheap ape~~ _careful about gas spending_ you've probably found yourself in the situation of wanting to batch inter-dependant transactions (like approving a token and then swapping it) at lower than market gas price EIP1559 is nice, but there's no way you'll allow these transaction to suck you eth up to twice the market price, right ?.
  Well, unless you're a web3 wizard there's no easy way to batch these tx and you end up waiting for each and every transaction in the list to confirm (and it takes a while because you're under current prices) before being able to trigger the next tx from the dApp's UI.
  This is where this bot comes handy, it will notify you when your last tx is confirmed so you can push the next one. No need to stay in front of your computer anymore, you can leave and come back just in time.

- Another usage is plain and simple spying of your addresses of interest. Wanna know what vitalik does before anyone else ? Just add his addresses to your watchlist.
  Current limit is 15 addresses watched (might change in the future).

## Accessing the bot

Search for `@TxWatcher_bot` on Telegram

## Development

### Install Dependencies

```bash
yarn install
```

### Run

```bash
yarn start
```
