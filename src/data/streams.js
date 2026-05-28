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
  metadataUrl,
  fmMonitorUrl = null,
  fmFallbackUrl = null
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
    fmMonitorUrl,
    fmFallbackUrl,
    aliases,
    metadataOfflineMeansDown
  }
}

function buildSrvstm({ id, name, city, state = 'MG', frequency, streamUrl, fmMonitorUrl = null, fmFallbackUrl = null }) {
  return {
    id,
    name,
    city,
    state,
    frequency,
    provider: 'Srvstm',
    protocol: 'HTTP Audio',
    slug: id,
    streamUrl,
    publicUrl: streamUrl,
    metadataUrl: null,
    fallbackUrl: null,
    fmMonitorUrl,
    fmFallbackUrl,
    aliases: [],
    metadataOfflineMeansDown: false
  }
}

export const streams = [
    buildSrvstm({
    id: '88-fm-sede-belo-horizonte',
    name: 'Rádio 88 FM - SEDE',
    city: 'Volta Redonda',
    state: 'RJ',
    frequency: '88,7 MHz',
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
    streamUrl: 'https://stm39.srvstm.com:9776/stream'
  }),
  buildSrvstm({
    id: 'maravilha-fm-sede-belo-horizonte',
    name: '89 Maravilha FM - SEDE',
    city: 'Belo Horizonte',
    frequency: '89,1 MHz',
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
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
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
    metadataOfflineMeansDown: true
  }),
  buildSoundstream({
    id: 'maravilha-fm-barbacena',
    name: 'Maravilha FM Barbacena',
    city: 'Barbacena',
    frequency: '89,3 MHz',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmbarbacena',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_barbacena',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_barbacena',
    port: 8020
  }),
    buildSoundstream({
    id: 'maravilha-fm-governador-valadares',
    name: 'Maravilha FM Governador Valadares',
    city: 'Governador Valadares',
    frequency: '89,3 MHz',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmgovernadorvaladares',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_governadorvaladares',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_governadorvaladares',
    port: 8020
  }),
  buildSoundstream({
    id: 'maravilha-fm-ipatinga',
    name: 'Maravilha FM Ipatinga',
    city: 'Ipatinga',
    frequency: '89,5 FM',
    host: 'srv2.soundstream.com.br',
    slug: 'maravilhafmipatinga',
    streamUrl: 'https://srv2.soundstream.com.br/listen/maravilhafmipatinga/live',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_ipatinga',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_ipatinga',
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
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
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
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafm/live',
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
    aliases: ['Rádio Maravilha FM']
  }),
  buildSoundstream({
    id: 'maravilha-fm-teofilo-otoni',
    name: 'Maravilha FM Teófilo Otoni',
    city: 'Teófilo Otoni',
    frequency: '89,7 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhateofilootoni',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhateofilootoni/live',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_teofilootoni',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_teofilootoni',
    port: 8240
  }),
  buildSoundstream({
    id: 'maravilha-fm-campos-gerais',
    name: 'Maravilha FM Campos Gerais',
    city: 'Campos Gerais',
    frequency: '97,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhacamposgerais',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhacamposgerais/live',
    // fmMonitorUrl: 'ADICIONE_AQUI_O_LINK_DO_FM',
    port: 8170
  }),
  buildSoundstream({
    id: 'maravilha-fm-uba',
    name: 'Maravilha FM Ubá',
    city: 'Ubá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmuba',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmuba/live',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_uba',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_uba',
    port: 8040
  }),
  buildSoundstream({
    id: 'maravilha-fm-montes-claros',
    name: 'Maravilha FM Montes Claros',
    city: 'Montes Claros',
    frequency: '89,5 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmmontesclaros',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_montesclaros',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_montesclaros',
    port: 8020
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberlandia',
    name: 'Maravilha FM Uberlândia',
    city: 'Uberlândia',
    frequency: '89,7 FM',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_uberlandia',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_uberlandia',
    streamUrl: 'https://stm6.srvstm.com:7076/stream'
  }),
  buildSrvstm({
    id: 'maravilha-fm-uberaba',
    name: 'Maravilha FM Uberaba',
    city: 'Uberaba',
    frequency: '89,3 FM',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_uberaba',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_uberaba',
    streamUrl: 'https://stm6.srvstm.com:7006/stream'
  }),
  buildSoundstream({
    id: 'maravilha-fm-leopoldina',
    name: 'Maravilha FM Leopoldina',
    city: 'Leopoldina',
    frequency: '89,1 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmleopoldina',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmleopoldina/live',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_leopoldina',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_leopoldina',
    port: 8270
  }),
  buildSoundstream({
    id: 'maravilha-fm-araxa',
    name: 'Maravilha FM Araxá',
    city: 'Araxá',
    frequency: '89,9 FM',
    host: 'srv.soundstream.com.br',
    slug: 'maravilhafmaraxa',
    streamUrl: 'https://srv.soundstream.com.br/listen/maravilhafmaraxa/live',
    fmMonitorUrl: 'http://192.168.70.253:8870/radiofm_araxa',
    fmFallbackUrl: 'http://streaming.grupogtf.com.br:8870/radiofm_araxa',
    port: 8290
  })
]
export const allStreamIds = streams.map((stream) => stream.id)