export const navigation = [
  {
    title: 'Introduction',
    links: [
      { title: 'How to read this site', href: '/' },
      { title: 'Components catalog', href: '/docs/components-catalog' },
    ],
  },
  {
    title: 'Subsystems',
    href: '/docs/subsystems',
    links: [
      { title: 'Dispatch daemon', href: '/docs/subsystems/dispatch-daemon' },
      { title: 'Scheduler', href: '/docs/subsystems/scheduler' },
      { title: 'WebSocket streams', href: '/docs/subsystems/websocket-streams' },
      { title: 'Horizon queues', href: '/docs/subsystems/horizon-queues' },
      { title: 'Market regime', href: '/docs/subsystems/market-regime' },
    ],
  },
  {
    title: 'Servers',
    href: '/docs/servers',
    links: [
      { title: 'Architecture overview', href: '/docs/servers/architecture-overview' },
      { title: 'Hyperion (database + Redis)', href: '/docs/servers/hyperion' },
      { title: 'Athena (ingestion + web)', href: '/docs/servers/athena' },
      { title: 'Eos + Iris + Nyx (workers)', href: '/docs/servers/eos-iris' },
      { title: 'Tyche (indicators + cronjobs)', href: '/docs/servers/tyche' },
    ],
  },
  {
    title: 'Business domains',
    href: '/docs/domains',
    links: [
      { title: 'Open positions', href: '/docs/domains/open-positions' },
      { title: 'Orders', href: '/docs/domains/orders' },
      { title: 'Accounts', href: '/docs/domains/accounts' },
      { title: 'Indicators', href: '/docs/domains/indicators' },
      { title: 'Token selection', href: '/docs/domains/token-selection' },
    ],
  },
  {
    title: 'Lifecycles',
    href: '/docs/lifecycles',
    links: [
      { title: 'Position lifecycle', href: '/docs/lifecycles/position-lifecycle' },
      { title: 'Signal → direction', href: '/docs/lifecycles/signal-direction' },
      { title: 'Order lifecycle', href: '/docs/lifecycles/order-lifecycle' },
    ],
  },
]
