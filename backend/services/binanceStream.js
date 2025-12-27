const WebSocket = require('ws');
const { classify } = require('./whaleDetector');

let binanceWS = null;

function connect(io, recentTrades, MAX_HISTORY) {
  // create a new websocket connection to Binance trade stream
  binanceWS = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

  binanceWS.on('open', () => {
    console.log('✅ Connected to Binance stream');
    io.emit('connection-status', { connected: true });
  });

  binanceWS.on('message', (data) => {
    // lightweight message counter for debugging
    if (!binanceWS._msgCounter) binanceWS._msgCounter = 0
    binanceWS._msgCounter += 1
    try {
      const trade = JSON.parse(data);
      const price = parseFloat(trade.p);
      const quantity = parseFloat(trade.q);
      const value = price * quantity;
      const timestamp = trade.T;
      const isBuy = !trade.m;

      const tradeData = {
        price,
        quantity,
        value,
        timestamp,
        type: isBuy ? 'BUY' : 'SELL',
        time: new Date(timestamp).toLocaleTimeString()
      };

      recentTrades.push(tradeData);
      if (recentTrades.length > MAX_HISTORY) recentTrades.shift();

      // debug: log occasional trade values to help diagnose detection issues
      if (binanceWS._msgCounter <= 5 || binanceWS._msgCounter % 5000 === 0) {
        console.log(`🔁 Binance trade #${binanceWS._msgCounter} value=$${value.toFixed(2)} price=${price} qty=${quantity}`)
      }

      io.emit('trade', tradeData);

      const whaleType = classify(value);
      if (whaleType) {
        const whaleAlert = { ...tradeData, whaleType, id: `${timestamp}-${Math.random()}` };
        io.emit('whale-alert', whaleAlert);
        console.log(`🐋 ${whaleType} detected: $${value.toFixed(2)}`);
      }
    } catch (err) {
      console.error('Error parsing Binance message', err);
    }
  });

  binanceWS.on('error', (err) => {
    console.error('❌ Binance WebSocket error:', err.message || err);
    io.emit('connection-status', { connected: false, error: err.message });
  });

  binanceWS.on('close', () => {
    console.log('🔌 Binance WebSocket closed — reconnecting in 5s');
    io.emit('connection-status', { connected: false });
    setTimeout(() => connect(io, recentTrades, MAX_HISTORY), 5000);
  });
}

module.exports = { connect };
