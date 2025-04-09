const b4a = require('b4a')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const sodium = require('sodium-universal')
const crypto = require("hypercore-crypto")
const process = require("bare-process")
const Protomux = require('protomux')
const c = require('compact-encoding')
const Hypercore = require('hypercore')
const { generateMnemonic, mnemonicToSeed } = require('bip39-mnemonic')
const fs = require('bare-fs/promises')


const topic_hex = 'ffb09601562034ee8394ab609322173b641ded168059d256f6a3d959b2dc6021'
const topic = b4a.from(topic_hex, 'hex')

/******************************************************************************
  START
******************************************************************************/

start()

async function start (iid) {
  const name = process.argv[2] || 'peer-' + Math.random().toString(36).substring(2, 8)
  const label = `\x1b[${process.pid % 2 ? 31 : 34}m[${name}]\x1b[0m`
  const startTime = process.hrtime()
  console.log(label, 'start')

  // Check if mnemonic exists, if not generate new one
  let mnemonic
  try {
    mnemonic = await fs.readFile(`mnemonic-${name}.txt`, 'utf-8')
    console.log(label, '📝 Using existing mnemonic')
  } catch (err) {
    mnemonic = generateMnemonic()
    await fs.writeFile(`mnemonic-${name}.txt`, mnemonic)
    console.log(label, '📝 Generated new mnemonic')
  }

  const seed = await mnemonicToSeed(mnemonic)
  const seed32 = seed.slice(0, 32) //keypair generation expects 32 bytes

  const opts = {
    namespace: 'noisekeys',
    seed: seed32,
    name: 'noise'
  }
  const { publicKey, secretKey } = create_noise_keypair(opts)
  console.log(label, { peerkey: publicKey.toString('hex') })
  const keyPair = { publicKey, secretKey }
  const store = new Corestore(`./storage-${name}`)
  const swarm = new Hyperswarm({ keyPair })
  const core = store.get({ name: 'test-core' })
  await core.ready()
  swarm.on('connection', onconnection)
  core.on('append', onappend)
  console.log(label, { corekey: core.key.toString('hex') })
  const discovery = swarm.join(topic, { server: true, client: true })
  await discovery.flushed()
  

 
  iid = setInterval(append_more, 3000)

  
  setInterval(() => {
    console.log(label, `👥 Connected peers: ${swarm.connections.size}`)
  }, 10000)

  function append_more () {
    const time = Math.floor(process.hrtime(startTime)[0])
    const stamp = `${time/60/60|0}h:${time/60|0}m:${time%60}s`
    const entry = {
      type: 'uptime',
      peer: name,
      data: process.hrtime(),
      stamp: stamp
    }
    core.append(JSON.stringify(entry))
  }

  async function onconnection (socket, info) {
    const peerName = info.publicKey.toString('hex').slice(0, 8)
    console.log(label, `📡 Peer ${peerName} connected`)
    
    socket.on('close', () => {
      console.log(label, `❌ Peer ${peerName} disconnected`)
    })

    const replicationStream = Hypercore.createProtocolStream(socket)
    const mux = Hypercore.getProtocolMuxer(replicationStream)
    
    // Set up replication first
    store.replicate(replicationStream)
    replicationStream.on('error', (err) => {
      console.log(label, '❌ Replication error:', err.message)
    })

    make_protocol({ 
      mux, 
      opts: { protocol: 'book/announce' }, 
      cb: async () => {
        const channel = create_and_open_channel({ 
          mux, 
          opts: { protocol: 'book/announce' } 
        })
        if (!channel) return

        const message = channel.addMessage({ 
          encoding: c.string, 
          onmessage: async (peerBookKey) => {
           
            console.log(label, `📖 Received book key from peer ${peerName}:`, peerBookKey)
            const remoteCore = store.get(b4a.from(peerBookKey, 'hex'))
            await remoteCore.ready()
            
            // A bit changed version of your existing code to download all old entries first
            console.log(label, `📚 Reading previous entries from peer ${peerName}...`)
            for (let i = 0; i < remoteCore.length; i++) {
              try {
                const data = await remoteCore.get(i)
                const entry = JSON.parse(data.toString())
                console.log(label, '📚', entry)
              } catch (err) {
                console.log(label, '❌', err)
              }
            }
            
            // Subscribing to new updates
            remoteCore.on('append', async () => {
              const lastBlock = remoteCore.length - 1
              try {
                const data = await remoteCore.get(lastBlock)
                const entry = JSON.parse(data.toString())
                console.log(label, '📬', entry)
              } catch (err) {
                console.log(label, '❌', err)
              }
            })
          }
        })

        console.log(label, `📤 Sending our book key to peer ${peerName}...`)
        message.send(core.key.toString('hex'))
        console.log(label, `✅ Sent our book key to peer ${peerName}:`, core.key.toString('hex'))
      }
    })
  }

 async function onappend () {
    const L = core.length
    core.get(L - 1).then(data => {
      const entry = JSON.parse(data.toString())
      console.log(label, '📬', entry)
    })
  }

}



/******************************************************************************
  HELPER
******************************************************************************/

function create_noise_keypair ({namespace, seed, name}) {
  const noiseSeed = deriveSeed(seed, namespace, name)
  const publicKey = b4a.alloc(32)
  const secretKey = b4a.alloc(64)
  if (noiseSeed) sodium.crypto_sign_seed_keypair(publicKey, secretKey, noiseSeed)
  else sodium.crypto_sign_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

function deriveSeed (primaryKey, namespace, name) {
  if (!b4a.isBuffer(namespace)) namespace = b4a.from(namespace) 
  if (!b4a.isBuffer(name)) name = b4a.from(name)
  if (!b4a.isBuffer(primaryKey)) primaryKey = b4a.from(primaryKey)
  const out = b4a.alloc(32)
  sodium.crypto_generichash_batch(out, [namespace, name, primaryKey])
  return out
}

async function make_protocol ({ mux, opts, cb }) {
  mux.pair(opts, cb)
  const opened = await mux.stream.opened
  if (opened) cb()
}

function create_and_open_channel ({ mux, opts }) {
  const channel = mux.createChannel(opts)
  if (!channel) return
  channel.open()
  return channel
} 
