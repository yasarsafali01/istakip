/* Demo hesapları — same groups as the web login page; tap one to fill the form. */
export const DEMO_ACCOUNTS: { group: string; color: string; accounts: { label: string; email: string; password: string; badge: string }[] }[] = [
  {
    group: 'Yönetim',
    color: '#0052CC',
    accounts: [
      { label: 'Sistem Yöneticisi', email: 'admin@example.com', password: 'admin123', badge: 'System Admin' },
    ],
  },
  {
    group: 'Bilgi İşlem — Donanım Müdürlüğü',
    color: '#00875A',
    accounts: [
      { label: 'Ayşe Kaya (Daire Başkanı)', email: 'bigd.baskan@example.com', password: 'pass123', badge: 'Dept. Head' },
      { label: 'Mehmet Demir (Müdür)', email: 'bigd.pm@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Ali Yılmaz (Üye)', email: 'bigd.worker1@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Fatma Şahin (Üye)', email: 'bigd.worker2@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Hasan Çelik (Üye)', email: 'bigd.worker3@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Elif Arslan (Üye)', email: 'bigd.worker4@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Bilgi İşlem — Siber Güvenlik Projesi',
    color: '#8777D9',
    accounts: [
      { label: 'Burak Yıldırım (Müdür)', email: 'bigd.pm2@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Murat Öztürk (Üye)', email: 'bigd.worker5@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Selin Aydın (Üye)', email: 'bigd.worker6@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Kemal Doğan (Üye)', email: 'bigd.worker7@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Zehra Koç (Üye)', email: 'bigd.worker8@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Öğrenci İşleri — Öğrenci Bilgi Sistemi',
    color: '#FF5630',
    accounts: [
      { label: 'Zeynep Çelik (Daire Başkanı)', email: 'odb.baskan@example.com', password: 'pass123', badge: 'Dept. Head' },
      { label: 'Can Öztürk (Müdür)', email: 'odb.pm@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Deniz Yıldız (Üye)', email: 'odb.worker1@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Burak Kara (Üye)', email: 'odb.worker2@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Neslihan Güneş (Üye)', email: 'odb.worker3@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Tarık Polat (Üye)', email: 'odb.worker4@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Öğrenci İşleri — Dijital Belge Yönetimi',
    color: '#FFAB00',
    accounts: [
      { label: 'Seda Kılıç (Müdür)', email: 'odb.pm2@example.com', password: 'pass123', badge: 'PM' },
      { label: 'Gizem Yılmaz (Üye)', email: 'odb.worker5@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Serkan Avcı (Üye)', email: 'odb.worker6@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Pınar Erdoğan (Üye)', email: 'odb.worker7@example.com', password: 'pass123', badge: 'Worker' },
      { label: 'Emre Şimşek (Üye)', email: 'odb.worker8@example.com', password: 'pass123', badge: 'Worker' },
    ],
  },
  {
    group: 'Talep Sahipleri',
    color: '#36B37E',
    accounts: [
      { label: 'Üniversite Personeli', email: 'dis.kullanici@example.com', password: 'pass123', badge: 'Personel' },
      { label: 'Öğrenci', email: 'ogrenci@example.com', password: 'pass123', badge: 'Öğrenci' },
    ],
  },
];
