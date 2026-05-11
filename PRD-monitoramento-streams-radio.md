# PRD - Plataforma de Monitoramento e Controle de Streams de Radio

## 1. Resumo Executivo

Este documento define o Product Requirements Document da plataforma de monitoramento e controle operacional de streams de radio de uma rede de emissoras e afiliadas. O objetivo do produto e centralizar a visibilidade operacional, detectar falhas rapidamente, acionar alertas automatizados e permitir a execucao de comandos remotos quando houver integracao com a origem do streaming.

O sistema devera monitorar links publicos de transmissao de audio, como endpoints Icecast, Shoutcast, HLS ou servidores HTTP de stream continuo, exibindo em tempo real o estado de cada emissora em um painel centralizado semelhante ao modelo de referencia analisado.

## 2. Contexto

Hoje existe a necessidade de acompanhar diversos links de streaming de radios da rede, por exemplo:

| Rede | Localidade | URL |
|---|---|---|
| Maravilha FM - SEDE | Belo Horizonte - MG | `https://stm19.srvstm.com:7080/stream` |
| Maravilha FM - Afiliadas | Cambui - MG | `https://srv2.soundstream.com.br/listen/maravilhafmcambui/live` |
| Maravilha FM - Afiliadas | Barbacena - MG | `https://srv2.soundstream.com.br/listen/maravilhafmbarbacena/live` |
| Maravilha FM - Afiliadas | Ipatinga - MG | `https://srv2.soundstream.com.br/listen/maravilhafmipatinga/live` |
| Maravilha FM - Afiliadas | Uberlandia - MG | `https://stm6.srvstm.com:7076/stream` |
| Maravilha FM - Afiliadas | Uberaba - MG | `https://stm6.srvstm.com:7006/stream` |
| Maravilha FM - Afiliadas | Juiz de Fora - MG | `https://srv.soundstream.com.br:8030/live` |
| Maravilha FM - Afiliadas | Joao Pinheiro - MG | `https://srv.soundstream.com.br/listen/maravilhafm/live` |
| Maravilha FM - Afiliadas | Montes Claros - MG | `https://srv.soundstream.com.br/listen/maravilhafmmontesclaros/live` |
| Maravilha FM - Afiliadas | Uba - MG | `https://srv.soundstream.com.br/listen/maravilhafmuba/live` |
| Maravilha FM - Afiliadas | Campos Gerais - MG | `https://srv.soundstream.com.br/listen/maravilhacamposgerais/live` |

O problema nao e apenas saber se a URL responde. O sistema precisa diferenciar stream ativo de stream com silencio, identificar falhas recorrentes, registrar historico operacional e, quando houver integracao com a infraestrutura de origem, executar acoes remotas como reconectar, reiniciar encoder, interromper ou restabelecer a transmissao.

## 3. Objetivo do Produto

Criar uma plataforma web centralizada para:

- Monitorar continuamente a disponibilidade e a saude de streams de radio.
- Exibir em painel operacional o status de cada emissora em tempo real.
- Permitir monitoramento auditivo individual e coletivo dos canais.
- Detectar quedas, silencio e anomalias tecnicas.
- Disparar alertas automatizados por WhatsApp e outros canais.
- Executar acoes remotas de resposta quando houver suporte na origem.
- Consolidar historico de incidentes, comandos e disponibilidade.

## 4. Escopo do Produto

### 4.1 Escopo Incluido

- Cadastro de emissoras, afiliadas, localidades e endpoints.
- Monitoramento ativo dos links publicos de streaming.
- Painel web em tempo real com cards por emissora.
- Player individual por stream.
- Acoes coletivas como escutar todos, mutar todos e reconectar todos.
- Deteccao de indisponibilidade.
- Deteccao de ausencia de audio e silencio prolongado.
- Exibicao de metadados, quando disponiveis.
- Exibicao de quantidade de listeners, quando disponivel.
- Historico de incidentes e indisponibilidade.
- Alertas automatizados por WhatsApp.
- Integracao opcional com agentes remotos instalados nas emissoras.
- Auditoria de comandos e operacoes.

### 4.2 Escopo Excluido no MVP

- Edicao de audio ao vivo.
- Automacao de playout da radio.
- Gerenciamento editorial da programacao.
- Substituicao completa de ferramentas profissionais de automacao da emissora.
- Integracao com hardware especifico sem validacao previa.

## 5. Perfis de Usuario

### 5.1 Operador de Rede

Responsavel por acompanhar o painel, ouvir os streams, validar incidentes e executar acoes basicas.

### 5.2 Tecnico de Streaming

Responsavel por diagnosticar falhas, atuar em reconexoes, validar configuracoes e administrar agentes remotos.

### 5.3 Gestor Operacional

Responsavel por acompanhar SLA, disponibilidade, recorrencia de incidentes e desempenho geral da rede.

### 5.4 Administrador

Responsavel por gerenciar usuarios, permissoes, regras de alerta, integracoes e configuracoes globais.

## 6. Problemas a Resolver

- Falta de visibilidade centralizada dos streams da rede.
- Deteccao tardia de quedas de transmissao.
- Dificuldade em diferenciar stream online de stream sem audio util.
- Ausencia de historico confiavel de incidentes.
- Dependencia de verificacao manual por operadores.
- Tempo alto de resposta para restauracao de transmissao.
- Falta de padrao para notificacao e automacao operacional.

## 7. Premissas e Restricoes

### 7.1 Premissas

- Os links publicos de streaming permanecerao acessiveis para monitoramento.
- Parte das emissoras pode operar em provedores terceiros.
- Nem todos os endpoints publicos fornecerao metadata ou informacoes de listeners.
- Acoes reais de reconectar ou parar stream exigirao acesso a infraestrutura de origem ou uso de agente remoto.

### 7.2 Restricoes

- Apenas monitorar a URL publica nao garante capacidade de controlar a transmissao.
- Em casos de streaming hospedado por terceiros, a automacao dependera de API do provedor ou controle do encoder local.
- Alertas por WhatsApp podem depender de provedores pagos ou API oficial.

## 8. Requisitos Funcionais

### 8.1 Cadastro e Gestao

- RF-01: Permitir cadastro de emissoras e afiliadas.
- RF-02: Permitir cadastro de cidade, estado, tipo de unidade e prioridade operacional.
- RF-03: Permitir cadastro de um ou mais endpoints por emissora.
- RF-04: Permitir classificar o tipo do stream, por exemplo Icecast, Shoutcast, HLS ou stream HTTP generico.
- RF-05: Permitir ativar ou desativar streams do monitoramento.

### 8.2 Painel Operacional

- RF-06: Exibir painel em tempo real com um card por stream monitorado.
- RF-07: Mostrar nome da emissora, localidade, status e URL principal.
- RF-08: Exibir cor de status por severidade.
- RF-09: Permitir mudar o layout do painel entre 1, 2 ou mais colunas.
- RF-10: Permitir reproduzir audio individualmente por card.
- RF-11: Permitir acao global de escutar todos.
- RF-12: Permitir mutar individualmente ou globalmente.
- RF-13: Permitir modo solo por emissora.

### 8.3 Monitoramento Tecnico

- RF-14: Verificar se o endpoint responde.
- RF-15: Medir latencia de conexao.
- RF-16: Verificar recebimento continuo de bytes.
- RF-17: Detectar quedas do stream.
- RF-18: Detectar stream online com ausencia de audio.
- RF-19: Detectar silencio acima de limite configuravel.
- RF-20: Coletar metadata da transmissao quando disponivel.
- RF-21: Coletar quantidade de listeners quando disponivel.
- RF-22: Detectar bitrate abaixo do esperado.
- RF-23: Detectar falhas recorrentes por janela de tempo.

### 8.4 Incidentes e Historico

- RF-24: Abrir incidente automaticamente ao detectar falha.
- RF-25: Fechar incidente automaticamente quando o stream recuperar.
- RF-26: Permitir fechamento manual com observacao.
- RF-27: Registrar linha do tempo do incidente.
- RF-28: Manter historico de disponibilidade por stream.

### 8.5 Comandos e Automacao

- RF-29: Permitir executar comando de reconectar stream.
- RF-30: Permitir executar comando de restart de encoder, quando suportado.
- RF-31: Permitir executar comando de stop/start de transmissao, quando suportado.
- RF-32: Permitir acao em massa para reconectar todos os streams controlados.
- RF-33: Permitir politicas automaticas de tentativa de recuperacao.
- RF-34: Registrar auditoria de todos os comandos enviados.

### 8.6 Alertas

- RF-35: Disparar alerta por WhatsApp em falhas operacionais.
- RF-36: Permitir regra por severidade, grupo e horario.
- RF-37: Evitar alertas duplicados para a mesma ocorrencia.
- RF-38: Notificar recuperacao do stream.
- RF-39: Permitir escalonamento caso a falha persista.

### 8.7 Administracao

- RF-40: Gerenciar usuarios e perfis de acesso.
- RF-41: Controlar permissoes por papel.
- RF-42: Configurar tempos de checagem e limiares de deteccao.
- RF-43: Configurar provedores de notificacao.
- RF-44: Configurar agentes remotos e tokens de autenticacao.

## 9. Requisitos Nao Funcionais

- RNF-01: O painel devera refletir alteracoes de status em tempo quase real, preferencialmente abaixo de 3 segundos de atraso visual.
- RNF-02: A plataforma devera suportar pelo menos 200 streams sem redesenho estrutural.
- RNF-03: O sistema devera registrar logs estruturados para diagnostico e auditoria.
- RNF-04: O sistema devera possuir autenticacao e autorizacao baseadas em perfis.
- RNF-05: Toda comunicacao entre componentes devera ser criptografada.
- RNF-06: O backend devera operar com tolerancia a falhas de workers.
- RNF-07: O sistema devera permitir escalabilidade horizontal da camada de monitoramento.
- RNF-08: O painel deve ser utilizavel em desktop e tablet.
- RNF-09: O sistema deve manter rastreabilidade de incidentes e comandos por no minimo 12 meses, salvo politica diferente definida pelo negocio.

## 10. Visao de Arquitetura Recomendada

## 10.1 Principio Arquitetural

A recomendacao e um monolito modular com processamento assincro e componentes desacoplados por fila. Essa abordagem reduz complexidade inicial, acelera entrega e suporta crescimento sem exigir microservicos desde o primeiro momento.

## 10.2 Componentes

### Frontend Web

- Painel operacional em tempo real.
- Interface responsiva para operacao.
- Player HTML5 com controles de audio.
- Exibicao de status, metadata, listeners e historico.

### Backend API

- API REST para cadastro, configuracao e consultas.
- WebSocket para atualizacao em tempo real.
- Camada de autenticacao, autorizacao e auditoria.

### Workers de Monitoramento

- Processos dedicados para checar saude dos streams.
- Agendamento de probes em intervalos configuraveis.
- Publicacao de eventos de alteracao de status.

### Engine de Analise de Audio

- Uso de `ffmpeg` e `ffprobe` para amostrar audio.
- Deteccao de silencio, nivel RMS, clipping e continuidade.
- Geração opcional de waveform simplificada para interface.

### Fila de Tarefas

- Orquestracao de jobs de monitoramento, analise e notificacao.
- Reprocessamento controlado e retries.

### Banco de Dados

- Persistencia de configuracoes, incidentes, historicos, comandos e usuarios.

### Servico de Notificacao

- Integracao com WhatsApp e demais canais.
- Dedupe, escalonamento e notificacao de recuperacao.

### Agente Remoto Opcional

- Servico instalado na origem da emissora ou no encoder local.
- Recebe comandos assinados do painel central.
- Executa acoes locais como restart de encoder, restart de servico ou troca de fonte.

## 10.3 Stack Recomendada

- Frontend: `Next.js`
- Backend: `NestJS` ou `Fastify` com `TypeScript`
- Workers: `Node.js` com `BullMQ`
- Banco de dados: `PostgreSQL`
- Fila e cache: `Redis`
- Analise de audio: `ffmpeg` e `ffprobe`
- Realtime: `WebSocket`
- Infra inicial: `Docker Compose`
- Infra evolutiva: `Kubernetes`, se o volume justificar

## 11. Fluxos Operacionais

### 11.1 Fluxo de Monitoramento

1. O worker agenda uma probe do stream.
2. O sistema tenta conectar ao endpoint.
3. Sao coletados status HTTP, latencia, headers e bytes recebidos.
4. Uma amostra curta de audio e processada.
5. O sistema classifica o estado como online, instavel, sem audio, silencioso ou offline.
6. O painel e atualizado em tempo real.
7. Eventos relevantes geram incidente ou fechamento de incidente.

### 11.2 Fluxo de Incidente

1. O sistema detecta falha.
2. A regra de negocio valida se a falha ultrapassou o limiar configurado.
3. Um incidente e aberto.
4. O alerta e enviado ao grupo responsavel.
5. Se houver automacao, uma tentativa de recuperacao e disparada.
6. Se recuperar, o incidente e encerrado automaticamente.
7. Se persistir, o incidente e escalado.

### 11.3 Fluxo de Automacao Remota

1. O sistema identifica que a emissora possui agente remoto habilitado.
2. O backend envia comando autenticado ao agente.
3. O agente executa a rotina local definida.
4. O agente responde com sucesso, falha ou timeout.
5. O resultado e registrado na auditoria.
6. O sistema reavalia o estado do stream apos a acao.

## 12. Modelo de Dados Inicial

### 12.1 Entidades Principais

- `User`
- `Role`
- `Station`
- `StationGroup`
- `StreamEndpoint`
- `ProbeResult`
- `AudioSample`
- `Incident`
- `IncidentEvent`
- `NotificationRule`
- `NotificationDelivery`
- `Command`
- `CommandExecution`
- `RemoteAgent`
- `ProviderIntegration`

### 12.2 Campos Relevantes por Entidade

#### Station

- id
- nome
- tipo
- cidade
- estado
- prioridade
- ativo

#### StreamEndpoint

- id
- station_id
- nome
- url
- protocolo
- provedor
- bitrate_esperado
- intervalo_probe_segundos
- limite_silencio_segundos
- ativo
- controlavel

#### ProbeResult

- id
- stream_endpoint_id
- timestamp
- status
- http_status
- latencia_ms
- bytes_recebidos
- metadata
- listeners

#### AudioSample

- id
- probe_result_id
- duracao_segundos
- rms_medio
- silencio_detectado
- clipping_detectado
- observacoes

#### Incident

- id
- stream_endpoint_id
- tipo
- severidade
- status
- opened_at
- closed_at
- causa_presumida

#### Command

- id
- stream_endpoint_id
- tipo
- origem
- solicitado_por
- status
- criado_em

#### RemoteAgent

- id
- station_id
- identificador
- versao
- ultimo_heartbeat
- status
- token

## 13. Regras de Negocio Iniciais

- RN-01: Um stream sera considerado offline apenas apos exceder um numero minimo de falhas consecutivas, evitando falso positivo.
- RN-02: Um stream sera considerado sem audio quando houver conectividade mas ausencia de audio util em amostra valida.
- RN-03: Um incidente de silencio deve possuir limiar proprio, diferente do incidente de offline.
- RN-04: Alertas repetidos para o mesmo incidente devem ser deduplicados.
- RN-05: O evento de recuperacao deve ser notificado se houver alerta previo aberto.
- RN-06: Comandos de controle so poderao ser enviados para streams marcados como controlaveis.
- RN-07: Toda acao manual ou automatica deve ser auditada.
- RN-08: Streams de maior prioridade poderao ter frequencia de monitoramento mais alta.

## 14. Alertas e Integracoes

### 14.1 Canais de Alerta

- WhatsApp
- E-mail
- Telegram
- Webhook

### 14.2 Recomendacao para WhatsApp

Priorizar API oficial da Meta ou provedor empresarial que ofereca estabilidade, trilha de auditoria e governanca. O sistema deve permitir trocar o provider sem reescrever a regra de negocio.

### 14.3 Mensagens Minimas

#### Queda

`ALERTA: Maravilha FM - Uberaba - MG esta offline desde 14:32. Ultima verificacao falhou por timeout.`

#### Silencio

`ALERTA: Maravilha FM - Barbacena - MG esta com silencio detectado ha mais de 60 segundos.`

#### Recuperacao

`RECUPERADO: Maravilha FM - Uberaba - MG voltou a transmitir as 14:41.`

## 15. Distincao Entre Monitorar e Controlar

Este ponto e critico para o projeto.

### 15.1 Modo Observador

Quando houver apenas a URL publica do stream, o sistema podera:

- Monitorar disponibilidade.
- Ler metadata, quando disponivel.
- Verificar bytes trafegados.
- Detectar silencio e ausencia de audio.
- Alertar operadores.

### 15.2 Modo Controlado

Quando houver acesso a origem da transmissao, o sistema podera adicionalmente:

- Reiniciar encoder.
- Reiniciar processo local de stream.
- Trocar fonte de audio.
- Interromper e restabelecer transmissao.
- Executar failover.

### 15.3 Implicacao Pratica

O botao `Reconectar todos` so deve atuar de forma real nos streams com integracao valida. Nos demais casos, a plataforma deve informar que a recuperacao depende de acao manual ou acesso externo ao provedor.

## 16. Roadmap de Entrega

### Fase 1 - MVP Operacional

- Cadastro de emissoras e streams.
- Monitoramento online e offline.
- Painel em tempo real.
- Player individual.
- Historico basico de disponibilidade.
- Alertas por WhatsApp.

### Fase 2 - Saude de Audio e Incidentes

- Deteccao de silencio.
- Coleta de metadata.
- Coleta de listeners, quando disponivel.
- Gestao de incidentes.
- Dashboard de disponibilidade por periodo.
- Escalonamento de alertas.

### Fase 3 - Controle Remoto

- Cadastro e gestao de agentes remotos.
- Restart de encoder.
- Comandos de stop/start.
- Tentativas automaticas de recuperacao.
- Auditoria detalhada de comandos.

### Fase 4 - Inteligencia Operacional

- Analise de recorrencia por provedor.
- Alertas inteligentes baseados em horario.
- Classificacao de causa provavel.
- Relatorios executivos e SLA.

## 17. Criterios de Sucesso

- Reduzir o tempo medio para deteccao de falhas para menos de 1 minuto.
- Reduzir o tempo medio de resposta operacional apos falha.
- Atingir visibilidade centralizada de 100 por cento dos streams cadastrados.
- Manter historico confiavel para analise de indisponibilidade.
- Permitir automacao real em todas as emissoras que possuam agente ou integracao de origem.

## 18. Riscos do Projeto

- Dependencia de provedores terceiros de streaming sem API de controle.
- Falsos positivos se os limiares de monitoramento forem agressivos demais.
- Variacao de comportamento entre tipos de endpoints.
- Restricoes de licenciamento ou custo em provedores de WhatsApp.
- Complexidade de suporte em ambiente distribuido se cada emissora tiver infraestrutura heterogenea.

## 19. Perguntas Abertas

- Existe acesso administrativo aos encoders ou servidores de origem de cada afiliada?
- Ha possibilidade de instalar um agente remoto nas emissores?
- Os provedores atuais de streaming oferecem API ou painel automatizavel?
- O sistema deve monitorar apenas a transmissao publica ou tambem a automacao local?
- Qual sera o grupo responsavel pelos alertas de plantao?
- Qual e o tempo maximo aceitavel de indisponibilidade antes de escalar?
- Quais emissores devem ser classificadas como criticas?

## 20. Recomendacao Final

A arquitetura recomendada para iniciar o projeto e:

- painel web centralizado
- backend unico modular
- workers assincros de monitoramento
- analise tecnica com `ffmpeg`
- `PostgreSQL` para historico e configuracao
- `Redis` para filas e eventos
- notificacao via WhatsApp
- agente remoto opcional por emissora

Essa abordagem e a melhor combinacao entre velocidade de entrega, capacidade operacional e espaco para evolucao futura sem criar complexidade prematura.