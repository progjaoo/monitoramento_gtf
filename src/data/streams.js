function buildSoundstream({
  id,
  name,
  city,
  frequency,
  host,
  slug,
  port,
  aliases = [],
  metadataOfflineMeansDown = false,
  streamUrl,
  fallbackUrl,
  metadataUrl
}) {
  return {
    id,
    name,
    city,
    state: 'MG',
    frequency,
    provider: 'Soundstream',
    protocol: 'Icecast2',
    slug,
    streamUrl: streamUrl ?? `https://${host}/listen/${slug}/live`,
    publicUrl: `https://${host}/public/${slug}`,
    metadataUrl: metadataUrl === undefined ? `https://${host}/api/nowplaying/${slug}` : metadataUrl,
    fallbackUrl: fallbackUrl === undefined ? `http://${host}:${port}/live` : fallbackUrl,
    aliases,
    metadataOfflineMeansDown
  }
}

function buildSrvstm({ id, name, city, frequency, streamUrl }) {
  return {
    id,
    name,
    city,
    state: 'MG',
    frequency,
    provider: 'Srvstm',
    protocol: 'HTTP Audio',
    slug: id,
    streamUrl,
    publicUrl: streamUrl,
    metadataUrl: null,
    fallbackUrl: null,
    aliases: [],
    metadataOfflineMeansDown: false
  }
}

export const streams = [
  buildSrvstm({
    id: 'maravilha-fm-sede-belo-horizonte',
    name: 'Maravilha FM - SEDE',
    city: 'Belo Horizonte',
    frequency: '89,1 MHz',
    streamUrl: 'https://stm19.srvstm.com:7080/stream'
  }),
  buildSoundstream({
    id: 'maravilha-fm-cambui',
    name: 'Maravilha FM Cambuí',
    city: 'Cambuí',
    frequency: 'Afiliada',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmcambui',
    port: 8040,
    metadataOfflineMeansDown: true
  }),
  buildSoundstream({
    id: 'maravilha-fm-barbacena',
    name: 'Maravilha FM Barbacena',
    city: 'Barbacena',
    frequency: '89,3 MHz',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmbarbacena',
    port: 8020
  }),
  buildSoundstream({
    id: 'maravilha-fm-ipatinga',
    name: 'Maravilha FM Ipatinga',
    city: 'Ipatinga',
    frequency: '89,5 FM',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmipatinga',
    port: 8030
  }),
  buildSoundstream({
    id: 'maravilha-fm-juiz-de-fora',
    name: 'Maravilha FM Juiz de Fora',
    city: 'Juiz de Fora',
    frequency: '89,7 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmjf',
    port: 8030,
    streamUrl: 'https://srv.soundstream.com.br:8030/live',
    fallbackUrl: null,
    metadataUrl: null
  }),
  buildSoundstream({
    id: 'maravilha-fm-joao-pinheiro',
    name: 'Maravilha FM João Pinheiro',
    city: 'João Pinheiro',
    frequency: '96,3 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafm',
    port: 8180,
    aliases: ['Rádio Maravilha FM']
  }),
  buildSoundstream({
    id: 'maravilha-fm-teofilo-otoni',
    name: 'Maravilha FM Teófilo Otoni',
    city: 'Teófilo Otoni',
    frequency: '89,7 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhateofilootoni',
    port: 8240
  }),
  buildSoundstream({
    id: 'maravilha-fm-campos-gerais',
    name: 'Maravilha FM Campos Gerais',
    city: 'Campos Gerais',
    frequency: '97,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhacamposgerais',
    port: 8170
  }),
  buildSoundstream({
    id: 'maravilha-fm-uba',
    name: 'Maravilha FM Ubá',
    city: 'Ubá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmuba',
    port: 8040
  }),
  buildSoundstream({
    id: 'maravilha-fm-montes-claros',
    name: 'Maravilha FM Montes Claros',
    city: 'Montes Claros',
    frequency: '89,5 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmmontesclaros',
    port: 8020
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberlandia',
    name: 'Maravilha FM Uberlândia',
    city: 'Uberlândia',
    frequency: '89,7 FM',
    streamUrl: 'https://stm6.srvstm.com:7076/stream'
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberaba',
    name: 'Maravilha FM Uberaba',
    city: 'Uberaba',
    frequency: '89,3 FM',
    streamUrl: 'https://stm6.srvstm.com:7006/stream'
  }),
  buildSoundstream({
    id: 'maravilha-fm-leopoldina',
    name: 'Maravilha FM Leopoldina',
    city: 'Leopoldina',
    frequency: '89,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmleopoldina',
    port: 8270
  }),
  buildSoundstream({
    id: 'maravilha-fm-araxa',
    name: 'Maravilha FM Araxá',
    city: 'Araxá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmaraxa',
    port: 8290
  })
]

export const allStreamIds = streams.map((stream) => stream.id)
