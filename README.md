# P2P exchange using Hyperswarm, Corestore and Hypercore. Using bare (p2p friendly) runtime.


# Installation
1. [Node Package Manager](https://nodejs.org/en/download)
2. Bare runtime `npm install -g bare`
3. Install all the packages using `npm install`

# RUN
First peer:
`bare peer.js (any-name)`
e.g `bare peer.js afaan`

```bash
[afaan] start
[afaan] { peerkey: 'd23587bbe6ec2e772ab6980babc06ece52b2a5207c21cdf80b411efe0f83f587' }
[afaan] { corekey: '9518fa4263c0f96556ad215b7d98d90ece5057a4ae71fc5b822961554ec24a7d' }
[afaan] ≡ ✅ {
  type: 'uptime',
  peer: 'afaan',
  data: { '0': 7380, '1': 893030600 },
  stamp: '0h:0m:7s'
}
```
Now for Second peer:
`bare peer.js (any-other-name)` 
e.g `bare peer.js bob`
``` 
[amy] start
[amy] { peerkey: 'c7b6137b94e4744c22c793e8837b27106331474f1632e6e02c460addc71a0a6c' }
[amy] { corekey: 'b25908d7d9ef769aed13cf6ac76ce8fc5e36898e61b57750765cc54a99a7147c' }
[amy] ≡ ✅ {
  type: 'uptime',
  peer: 'bob',
  data: { '0': 7382, '1': 768024700 },
  stamp: '0h:0m:6s'
}

```
Now both peers will connect:
```
[afaan] ≡ ✅ Peer c7b6137b connected
[afaan] ≡ ✅ Sending our book key to peer c7b6137b...
[afaan] ✅ Sent our book key to peer c7b6137b: 9518fa4263c0f96556ad215b7d98d90ece5057a4ae71fc5b822961554ec24a7d
[afaan] ≡ ✅ Received book key from peer c7b6137b: b25908d7d9ef769aed13cf6ac76ce8fc5e36898e61b57750765cc54a99a7147c
[afaan] ≡ ✅ Reading previous entries from peer c7b6137b...
[afaan] ≡ ✅ {
  type: 'uptime',
  peer: 'bob',
  data: { '0': 7388, '1': 774223800 },
  stamp: '0h:0m:12s'
}

```


And so on..
You can connect as much peers as you want, just change the peer name.

It uses a random 32bytes Hardcoded Topic to connect all peers to the same network. You can change it if you want.

### 4. reset
if you want to start over, just delete the storage folder:
e.g.: `npm run reset`
