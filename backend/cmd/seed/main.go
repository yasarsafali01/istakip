// Command seed loads the demo unit/project/user/issue dataset used by the
// original frontend (src/data/seedData.js) into PostgreSQL. It is idempotent:
// if the units table already has rows, it does nothing.
package main

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/yasarsafali01/istakip/backend/internal/config"
	"github.com/yasarsafali01/istakip/backend/internal/db"
)

func mustTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		log.Fatalf("bad time %q: %v", s, err)
	}
	return t
}

// ─── seed data (mirrors frontend/src/data/seedData.js) ─────────────────────

type unitSeed struct {
	key, name, unitCode, deptHeadKey, createdAt string
}

var units = []unitSeed{
	{"unit-bigd", "Bilgi İşlem Daire Başkanlığı", "BIGD", "user-bigd-head", "2025-01-01T09:00:00Z"},
	{"unit-odb", "Öğrenci İşleri Daire Başkanlığı", "ODB", "user-odb-head", "2025-01-01T09:00:00Z"},
}

type userSeed struct {
	key, name, email, password, role, unitKey, projectKey, avatarColor string
}

var users = []userSeed{
	{"user-admin", "Sistem Yöneticisi", "admin@example.com", "admin123", "System_Admin", "", "", "#0052CC"},
	{"user-bigd-head", "Ayşe Kaya", "bigd.baskan@example.com", "pass123", "Department_Head", "unit-bigd", "", "#00875A"},
	{"user-bigd-pm", "Mehmet Demir", "bigd.pm@example.com", "pass123", "Project_Manager", "unit-bigd", "project-bigd-1", "#FF5630"},
	{"user-bigd-w1", "Ali Yılmaz", "bigd.worker1@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-1", "#6554C0"},
	{"user-bigd-w2", "Fatma Şahin", "bigd.worker2@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-1", "#FF991F"},
	{"user-bigd-w3", "Hasan Çelik", "bigd.worker3@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-1", "#36B37E"},
	{"user-bigd-pm2", "Burak Yıldırım", "bigd.pm2@example.com", "pass123", "Project_Manager", "unit-bigd", "project-bigd-2", "#8777D9"},
	{"user-bigd-w4", "Murat Öztürk", "bigd.worker4@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-2", "#00B8D9"},
	{"user-bigd-w5", "Selin Aydın", "bigd.worker5@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-2", "#FF7452"},
	{"user-bigd-w6", "Kemal Doğan", "bigd.worker6@example.com", "pass123", "Worker", "unit-bigd", "project-bigd-2", "#57D9A3"},
	{"user-odb-head", "Zeynep Çelik", "odb.baskan@example.com", "pass123", "Department_Head", "unit-odb", "", "#FF0000"},
	{"user-odb-pm", "Can Öztürk", "odb.pm@example.com", "pass123", "Project_Manager", "unit-odb", "project-odb-1", "#FFAA00"},
	{"user-odb-w1", "Deniz Yıldız", "odb.worker1@example.com", "pass123", "Worker", "unit-odb", "project-odb-1", "#2684FF"},
	{"user-odb-w2", "Burak Kara", "odb.worker2@example.com", "pass123", "Worker", "unit-odb", "project-odb-1", "#4BADE8"},
	{"user-odb-w3", "Neslihan Güneş", "odb.worker3@example.com", "pass123", "Worker", "unit-odb", "project-odb-1", "#65BA43"},
	{"user-odb-pm2", "Seda Kılıç", "odb.pm2@example.com", "pass123", "Project_Manager", "unit-odb", "project-odb-2", "#FF5630"},
	{"user-odb-w4", "Tarık Polat", "odb.worker4@example.com", "pass123", "Worker", "unit-odb", "project-odb-2", "#904EE2"},
	{"user-odb-w5", "Gizem Yılmaz", "odb.worker5@example.com", "pass123", "Worker", "unit-odb", "project-odb-2", "#FF8B00"},
	{"user-odb-w6", "Serkan Avcı", "odb.worker6@example.com", "pass123", "Worker", "unit-odb", "project-odb-2", "#E5493A"},
	{"user-external", "Dış Kullanıcı", "dis.kullanici@example.com", "pass123", "External_User", "", "", "#36B37E"},
}

type projectSeed struct {
	seedKey, jiraKey, name, description, unitKey, managerKey, createdAt string
	hasInventory                                                        bool
}

var projects = []projectSeed{
	{"project-bigd-1", "BIGD", "Ağ Altyapısı Yenileme", "Kurumun ağ altyapısının modernizasyonu ve güvenlik iyileştirmeleri", "unit-bigd", "user-bigd-pm", "2025-01-15T09:00:00Z", true},
	{"project-bigd-2", "BIGD2", "Siber Güvenlik Projesi", "Kurumsal siber güvenlik altyapısının güçlendirilmesi ve güvenlik politikalarının oluşturulması", "unit-bigd", "user-bigd-pm2", "2025-01-20T09:00:00Z", false},
	{"project-odb-1", "ODB", "Öğrenci Bilgi Sistemi", "Öğrenci kayıt, not ve belge işlemlerinin dijitalleştirilmesi", "unit-odb", "user-odb-pm", "2025-01-20T10:00:00Z", false},
	{"project-odb-2", "ODB2", "Dijital Belge Yönetimi", "Kurumsal belge yönetim sisteminin dijitalleştirilmesi ve arşivlenmesi", "unit-odb", "user-odb-pm2", "2025-02-01T10:00:00Z", false},
}

type sprintSeed struct {
	key, projectKey, name, startDate, endDate, status string
	month, year                                       int
}

var sprints = []sprintSeed{
	{"sprint-bigd1-apr", "project-bigd-1", "Nisan 2025", "2025-04-01T00:00:00Z", "2025-04-30T00:00:00Z", "Completed", 4, 2025},
	{"sprint-bigd2-apr", "project-bigd-2", "Nisan 2025", "2025-04-01T00:00:00Z", "2025-04-30T00:00:00Z", "Completed", 4, 2025},
	{"sprint-odb1-apr", "project-odb-1", "Nisan 2025", "2025-04-01T00:00:00Z", "2025-04-30T00:00:00Z", "Completed", 4, 2025},
	{"sprint-odb2-apr", "project-odb-2", "Nisan 2025", "2025-04-01T00:00:00Z", "2025-04-30T00:00:00Z", "Completed", 4, 2025},
	{"sprint-bigd1-may", "project-bigd-1", "Mayıs 2025", "2025-05-01T00:00:00Z", "2025-05-31T00:00:00Z", "Active", 5, 2025},
	{"sprint-bigd2-may", "project-bigd-2", "Mayıs 2025", "2025-05-01T00:00:00Z", "2025-05-31T00:00:00Z", "Active", 5, 2025},
	{"sprint-odb1-may", "project-odb-1", "Mayıs 2025", "2025-05-01T00:00:00Z", "2025-05-31T00:00:00Z", "Active", 5, 2025},
	{"sprint-odb2-may", "project-odb-2", "Mayıs 2025", "2025-05-01T00:00:00Z", "2025-05-31T00:00:00Z", "Active", 5, 2025},
}

type issueSeed struct {
	key, projectKey, sprintKey                  string
	number                                      int
	title, description, itype, priority, status string
	assigneeKey, reporterKey                    string
	isRequest                                   bool
	visibleTo                                   []string
	createdAt, updatedAt, resolvedAt            string
	timeSpent                                   int
}

var issues = []issueSeed{
	// project-bigd-1
	{"issue-bigd1-1", "project-bigd-1", "sprint-bigd1-apr", 1, "Ağ topolojisi analizi", "Mevcut ağ altyapısının topoloji haritasının çıkarılması ve darboğazların tespiti.", "Story", "Highest", "In Progress", "user-bigd-w1", "user-bigd-pm", false, nil, "2025-04-01T09:00:00Z", "2025-04-05T14:00:00Z", "", 0},
	{"issue-bigd1-2", "project-bigd-1", "sprint-bigd1-apr", 2, "Güvenlik duvarı yapılandırması", "Yeni nesil güvenlik duvarı kurallarının tanımlanması ve uygulanması.", "Task", "High", "To Do", "user-bigd-w2", "user-bigd-head", false, nil, "2025-04-01T09:30:00Z", "2025-04-01T09:30:00Z", "", 0},
	{"issue-bigd1-3", "project-bigd-1", "sprint-bigd1-apr", 3, "Switch ve router yenileme", "Eski switch ve router cihazlarının yeni donanımla değiştirilmesi.", "Task", "High", "In Review", "user-bigd-w3", "user-bigd-head", false, nil, "2025-04-02T10:00:00Z", "2025-04-06T11:00:00Z", "", 0},
	{"issue-bigd1-4", "project-bigd-1", "sprint-bigd1-apr", 4, "VPN altyapısı kurulumu", "Uzaktan çalışma için güvenli VPN altyapısının kurulması.", "Story", "Medium", "Done", "user-bigd-w1", "user-bigd-head", false, nil, "2025-04-01T11:00:00Z", "2025-04-10T16:00:00Z", "2025-04-10T16:00:00Z", 120},
	{"issue-bigd1-5", "project-bigd-1", "sprint-bigd1-apr", 5, "Ağ kesintisi hatası", "Yoğun saatlerde ağ bağlantısı zaman zaman kesiliyor, kök neden araştırılacak.", "Bug", "Highest", "In Progress", "user-bigd-w1", "user-bigd-pm", false, nil, "2025-04-03T08:00:00Z", "2025-04-07T09:00:00Z", "", 0},
	{"issue-bigd1-req1", "project-bigd-1", "", 6, "VPN erişim talebi", "Uzaktan çalışma için VPN erişimi talep ediyorum.", "Request", "Medium", "In Progress", "user-bigd-w1", "user-external", true, []string{"user-external"}, "2025-04-10T09:00:00Z", "2025-04-10T09:00:00Z", "", 0},
	{"issue-bigd1-7", "project-bigd-1", "sprint-bigd1-may", 7, "Ağ izleme sistemi kurulumu", "Ağ altyapısının sürekli izlenmesi için merkezi izleme sisteminin kurulumu.", "Story", "High", "In Progress", "user-bigd-w1", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-8", "project-bigd-1", "sprint-bigd1-may", 8, "Bandwidth analiz raporu", "Ağ bant genişliği kullanımının analiz edilmesi ve raporlanması.", "Task", "Medium", "To Do", "user-bigd-w1", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-9", "project-bigd-1", "sprint-bigd1-may", 9, "Yedekleme prosedürü güncelleme", "Mevcut yedekleme prosedürlerinin gözden geçirilmesi ve güncellenmesi.", "Task", "Low", "To Do", "user-bigd-w1", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-10", "project-bigd-1", "sprint-bigd1-may", 10, "Firewall kural seti revizyonu", "Mevcut firewall kurallarının gözden geçirilmesi ve optimize edilmesi.", "Task", "High", "In Progress", "user-bigd-w2", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-11", "project-bigd-1", "sprint-bigd1-may", 11, "DMZ yapılandırması", "Demilitarize zone yapılandırmasının oluşturulması ve test edilmesi.", "Story", "Highest", "To Do", "user-bigd-w2", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-12", "project-bigd-1", "sprint-bigd1-may", 12, "SSL sertifika yenileme", "Süresi dolan SSL sertifikalarının yenilenmesi ve yapılandırılması.", "Task", "Medium", "In Review", "user-bigd-w2", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-13", "project-bigd-1", "sprint-bigd1-may", 13, "Core switch firmware güncelleme", "Ana switch cihazlarının firmware sürümlerinin güncellenmesi.", "Task", "High", "In Progress", "user-bigd-w3", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-14", "project-bigd-1", "sprint-bigd1-may", 14, "Kablosuz ağ genişletme", "Kampüs kablosuz ağ kapsamının genişletilmesi ve iyileştirilmesi.", "Story", "Medium", "To Do", "user-bigd-w3", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd1-15", "project-bigd-1", "sprint-bigd1-may", 15, "Ağ dokümantasyonu hazırlama", "Ağ altyapısının güncel dokümantasyonunun hazırlanması.", "Task", "Low", "To Do", "user-bigd-w3", "user-bigd-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},

	// project-bigd-2
	{"issue-bigd2-1", "project-bigd-2", "sprint-bigd2-apr", 1, "Güvenlik açığı taraması", "Tüm sistemlerde güvenlik açığı taraması yapılması ve raporlanması.", "Story", "Highest", "In Progress", "user-bigd-w4", "user-bigd-pm2", false, nil, "2025-04-01T09:00:00Z", "2025-04-05T10:00:00Z", "", 0},
	{"issue-bigd2-2", "project-bigd-2", "sprint-bigd2-apr", 2, "Güvenlik politikası dokümantasyonu", "Kurumsal güvenlik politikalarının yazılı hale getirilmesi.", "Task", "High", "To Do", "user-bigd-w5", "user-bigd-head", false, nil, "2025-04-01T10:00:00Z", "2025-04-01T10:00:00Z", "", 0},
	{"issue-bigd2-3", "project-bigd-2", "sprint-bigd2-apr", 3, "Sızma testi planlaması", "Dış kaynaklı sızma testi için kapsam ve takvim belirlenmesi.", "Task", "High", "In Review", "user-bigd-w6", "user-bigd-pm2", false, nil, "2025-04-02T09:00:00Z", "2025-04-07T14:00:00Z", "", 0},
	{"issue-bigd2-4", "project-bigd-2", "sprint-bigd2-apr", 4, "Antivirüs yazılımı güncelleme", "Tüm istemci sistemlerde antivirüs yazılımının güncel sürüme yükseltilmesi.", "Task", "Medium", "Done", "user-bigd-w4", "user-bigd-head", false, nil, "2025-04-01T11:00:00Z", "2025-04-09T15:00:00Z", "2025-04-09T15:00:00Z", 90},
	{"issue-bigd2-5", "project-bigd-2", "sprint-bigd2-may", 5, "SIEM entegrasyonu", "Güvenlik bilgi ve olay yönetim sisteminin entegre edilmesi.", "Story", "Highest", "In Progress", "user-bigd-w4", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-6", "project-bigd-2", "sprint-bigd2-may", 6, "Log analiz otomasyonu", "Sistem loglarının otomatik analiz edilmesi için araç geliştirilmesi.", "Task", "High", "To Do", "user-bigd-w4", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-7", "project-bigd-2", "sprint-bigd2-may", 7, "Güvenlik dashboard tasarımı", "Güvenlik metriklerinin görselleştirilmesi için dashboard tasarımı.", "Task", "Medium", "To Do", "user-bigd-w4", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-8", "project-bigd-2", "sprint-bigd2-may", 8, "Phishing simülasyonu", "Çalışanlara yönelik phishing simülasyonu planlanması ve yürütülmesi.", "Story", "High", "In Progress", "user-bigd-w5", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-9", "project-bigd-2", "sprint-bigd2-may", 9, "Kullanıcı farkındalık eğitimi", "Bilgi güvenliği farkındalık eğitim materyallerinin hazırlanması.", "Task", "Medium", "In Review", "user-bigd-w5", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-10", "project-bigd-2", "sprint-bigd2-may", 10, "Güvenlik politikası güncellemesi", "Kurumsal güvenlik politikalarının güncellenmesi ve yayınlanması.", "Task", "Low", "To Do", "user-bigd-w5", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-11", "project-bigd-2", "sprint-bigd2-may", 11, "Endpoint koruma yazılımı dağıtımı", "Tüm istemci cihazlara endpoint koruma yazılımının yüklenmesi.", "Task", "High", "In Progress", "user-bigd-w6", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-12", "project-bigd-2", "sprint-bigd2-may", 12, "Zafiyet yönetim süreci", "Sistem zafiyetlerinin tespiti ve giderilmesi için süreç oluşturulması.", "Story", "Highest", "To Do", "user-bigd-w6", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-13", "project-bigd-2", "sprint-bigd2-may", 13, "İki faktörlü kimlik doğrulama", "Kritik sistemler için iki faktörlü kimlik doğrulama uygulanması.", "Task", "High", "To Do", "user-bigd-w6", "user-bigd-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-bigd2-req1", "project-bigd-2", "", 14, "Uzaktan erişim yetkisi talebi", "Evden çalışma için uzaktan erişim yetkisi talep ediyorum.", "Request", "High", "To Do", "user-bigd-w4", "user-external", true, []string{"user-external"}, "2025-05-02T10:00:00Z", "2025-05-02T10:00:00Z", "", 0},

	// project-odb-1
	{"issue-odb1-1", "project-odb-1", "sprint-odb1-apr", 1, "Öğrenci kayıt modülü", "Yeni öğrenci kayıt ve kabul süreçlerinin dijitalleştirilmesi.", "Story", "Highest", "In Progress", "user-odb-w1", "user-odb-pm", false, nil, "2025-04-01T09:00:00Z", "2025-04-05T10:00:00Z", "", 0},
	{"issue-odb1-2", "project-odb-1", "sprint-odb1-apr", 2, "Not giriş sistemi", "Öğretim üyelerinin not girişi yapabileceği modülün geliştirilmesi.", "Task", "High", "Done", "user-odb-w2", "user-odb-head", false, nil, "2025-04-01T10:00:00Z", "2025-04-08T15:00:00Z", "2025-04-08T15:00:00Z", 180},
	{"issue-odb1-3", "project-odb-1", "sprint-odb1-apr", 3, "Transkript üretim modülü", "Öğrenci transkriptlerinin otomatik oluşturulması ve PDF çıktısı.", "Story", "High", "In Review", "user-odb-w3", "user-odb-head", false, nil, "2025-04-02T09:00:00Z", "2025-04-06T10:00:00Z", "", 0},
	{"issue-odb1-4", "project-odb-1", "sprint-odb1-apr", 4, "Öğrenci portal giriş hatası", "Bazı öğrenciler sisteme giriş yapamıyor, şifre sıfırlama çalışmıyor.", "Bug", "Highest", "To Do", "user-odb-w1", "user-odb-pm", false, nil, "2025-04-03T09:00:00Z", "2025-04-03T09:00:00Z", "", 0},
	{"issue-odb1-req1", "project-odb-1", "", 5, "Transkript belgesi talebi", "Mezuniyet için resmi transkript belgesi talep ediyorum.", "Request", "Low", "In Review", "", "user-external", true, []string{"user-external"}, "2025-04-11T10:00:00Z", "2025-04-11T10:00:00Z", "", 0},
	{"issue-odb1-5", "project-odb-1", "sprint-odb1-may", 6, "Öğrenci danışmanlık modülü", "Akademik danışmanlık süreçlerinin dijitalleştirilmesi ve yönetimi.", "Story", "High", "In Progress", "user-odb-w1", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-6", "project-odb-1", "sprint-odb1-may", 7, "Ders programı entegrasyonu", "Ders programı bilgilerinin öğrenci bilgi sistemine entegre edilmesi.", "Task", "Medium", "To Do", "user-odb-w1", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-7", "project-odb-1", "sprint-odb1-may", 8, "Mobil uygulama API geliştirme", "Öğrenci mobil uygulaması için REST API geliştirilmesi.", "Task", "High", "To Do", "user-odb-w1", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-8", "project-odb-1", "sprint-odb1-may", 9, "Sınav sonuç bildirimi", "Sınav sonuçlarının öğrencilere otomatik bildirim sistemi.", "Task", "High", "In Progress", "user-odb-w2", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-9", "project-odb-1", "sprint-odb1-may", 10, "Öğrenci performans raporu", "Öğrenci akademik performansının görselleştirilmesi ve raporlanması.", "Story", "Medium", "In Review", "user-odb-w2", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-10", "project-odb-1", "sprint-odb1-may", 11, "Veri yedekleme otomasyonu", "Öğrenci verilerinin otomatik yedekleme sisteminin kurulması.", "Task", "Low", "To Do", "user-odb-w2", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-11", "project-odb-1", "sprint-odb1-may", 12, "Mezuniyet başvuru formu", "Mezuniyet başvuru sürecinin dijitalleştirilmesi ve otomasyonu.", "Story", "Highest", "In Progress", "user-odb-w3", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-12", "project-odb-1", "sprint-odb1-may", 13, "Belge doğrulama sistemi", "Resmi belgelerin otantikliğinin doğrulanması için sistem geliştirilmesi.", "Task", "High", "To Do", "user-odb-w3", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb1-13", "project-odb-1", "sprint-odb1-may", 14, "E-posta bildirim servisi", "Öğrenci işlemleri için e-posta bildirim servisinin geliştirilmesi.", "Task", "Medium", "To Do", "user-odb-w3", "user-odb-pm", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},

	// project-odb-2
	{"issue-odb2-1", "project-odb-2", "sprint-odb2-apr", 1, "Belge arşivleme sistemi", "Kurumsal belgelerin dijital ortamda arşivlenmesi için sistem tasarımı.", "Story", "High", "In Progress", "user-odb-w4", "user-odb-pm2", false, nil, "2025-04-01T09:00:00Z", "2025-04-05T11:00:00Z", "", 0},
	{"issue-odb2-2", "project-odb-2", "sprint-odb2-apr", 2, "Elektronik imza entegrasyonu", "Belge onay süreçlerinde elektronik imza kullanımının entegre edilmesi.", "Task", "High", "To Do", "user-odb-w5", "user-odb-head", false, nil, "2025-04-01T10:00:00Z", "2025-04-01T10:00:00Z", "", 0},
	{"issue-odb2-3", "project-odb-2", "sprint-odb2-apr", 3, "Belge arama motoru", "Arşivlenen belgeler için tam metin arama özelliğinin geliştirilmesi.", "Task", "Medium", "In Review", "user-odb-w6", "user-odb-pm2", false, nil, "2025-04-02T09:00:00Z", "2025-04-07T13:00:00Z", "", 0},
	{"issue-odb2-4", "project-odb-2", "sprint-odb2-apr", 4, "Belge şablonları oluşturma", "Sık kullanılan belge türleri için standart şablonların hazırlanması.", "Task", "Low", "Done", "user-odb-w4", "user-odb-head", false, nil, "2025-04-01T11:00:00Z", "2025-04-07T16:00:00Z", "2025-04-07T16:00:00Z", 60},
	{"issue-odb2-5", "project-odb-2", "sprint-odb2-may", 5, "OCR entegrasyonu", "Belge tarama ve optik karakter tanıma sisteminin entegre edilmesi.", "Story", "High", "In Progress", "user-odb-w4", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-6", "project-odb-2", "sprint-odb2-may", 6, "Belge versiyon kontrolü", "Belge revizyonlarının takibi için versiyon kontrol sisteminin kurulması.", "Task", "Medium", "To Do", "user-odb-w4", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-7", "project-odb-2", "sprint-odb2-may", 7, "Toplu belge içe aktarma", "Mevcut fiziksel belgelerin toplu olarak sisteme aktarılması.", "Task", "High", "To Do", "user-odb-w4", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-8", "project-odb-2", "sprint-odb2-may", 8, "Dijital imza doğrulama", "Elektronik imzaların geçerliliğinin doğrulanması için modül geliştirilmesi.", "Story", "Highest", "In Progress", "user-odb-w5", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-9", "project-odb-2", "sprint-odb2-may", 9, "Belge erişim yetkilendirme", "Belgelere erişim yetkilerinin rol bazlı yönetim sistemi.", "Task", "High", "In Review", "user-odb-w5", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-10", "project-odb-2", "sprint-odb2-may", 10, "Arşiv arama optimizasyonu", "Arşiv arama performansının iyileştirilmesi ve indeksleme optimizasyonu.", "Task", "Medium", "To Do", "user-odb-w5", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-11", "project-odb-2", "sprint-odb2-may", 11, "Belge şifreleme modülü", "Hassas belgelerin şifrelenmesi için güvenlik modülünün geliştirilmesi.", "Task", "High", "In Progress", "user-odb-w6", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-12", "project-odb-2", "sprint-odb2-may", 12, "Audit log sistemi", "Belge erişim ve değişiklik geçmişinin kayıt altına alınması.", "Story", "Medium", "To Do", "user-odb-w6", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
	{"issue-odb2-13", "project-odb-2", "sprint-odb2-may", 13, "Raporlama dashboard", "Belge yönetim istatistiklerinin görselleştirilmesi için dashboard.", "Task", "Low", "To Do", "user-odb-w6", "user-odb-pm2", false, nil, "2025-05-01T09:00:00Z", "2025-05-01T09:00:00Z", "", 0},
}

type commentSeed struct {
	issueKey, authorKey, text, createdAt string
}

var comments = []commentSeed{
	{"issue-bigd1-1", "user-bigd-head", "Topoloji haritası taslağı hazırlandı, incelemenizi bekliyorum.", "2025-04-05T10:00:00Z"},
	{"issue-bigd1-1", "user-bigd-pm", "Harika, darboğaz noktaları işaretlendi. Raporu hafta sonuna kadar tamamlayacağım.", "2025-04-05T14:30:00Z"},
	{"issue-bigd1-5", "user-bigd-w1", "Ağ trafiği logları incelendi, switch portlarında paket kaybı tespit edildi.", "2025-04-04T11:00:00Z"},
	{"issue-bigd1-5", "user-bigd-head", "Etkilenen switch'ler yedek cihazlarla değiştirildi, izleme devam ediyor.", "2025-04-07T09:00:00Z"},
	{"issue-odb1-3", "user-odb-w3", "Transkript şablonu hazırlandı, PDF kütüphanesi entegrasyonu devam ediyor.", "2025-04-06T15:00:00Z"},
	{"issue-bigd2-1", "user-bigd-head", "Güvenlik açığı taraması için öncelikli sistemler belirlendi.", "2025-04-05T10:00:00Z"},
	{"issue-odb2-1", "user-odb-pm2", "Arşivleme sistemi için teknik gereksinimler dokümanı paylaşıldı.", "2025-04-05T14:00:00Z"},
}

type activitySeed struct {
	issueKey, userKey, atype, description, createdAt string
}

var activities = []activitySeed{
	{"issue-bigd1-1", "user-bigd-pm", "created", "Issue oluşturuldu", "2025-04-01T09:00:00Z"},
	{"issue-bigd1-1", "user-bigd-w1", "status_change", `Durum "To Do" → "In Progress" olarak değiştirildi`, "2025-04-05T09:00:00Z"},
	{"issue-bigd1-3", "user-bigd-w3", "status_change", `Durum "In Progress" → "In Review" olarak değiştirildi`, "2025-04-06T11:00:00Z"},
	{"issue-bigd1-4", "user-bigd-w1", "status_change", `Durum "In Review" → "Done" olarak değiştirildi`, "2025-04-10T16:00:00Z"},
	{"issue-odb1-2", "user-odb-w2", "status_change", `Durum "In Review" → "Done" olarak değiştirildi`, "2025-04-08T15:00:00Z"},
	{"issue-bigd1-5", "user-bigd-pm", "assignment", "Ali Yılmaz'a atandı", "2025-04-03T08:30:00Z"},
	{"issue-odb1-3", "user-odb-w3", "status_change", `Durum "In Progress" → "In Review" olarak değiştirildi`, "2025-04-06T10:00:00Z"},
	{"issue-bigd1-1", "user-bigd-head", "comment", "Yorum ekledi", "2025-04-05T10:00:00Z"},
	{"issue-bigd2-1", "user-bigd-pm2", "created", "Issue oluşturuldu", "2025-04-01T09:00:00Z"},
	{"issue-bigd2-3", "user-bigd-w6", "status_change", `Durum "In Progress" → "In Review" olarak değiştirildi`, "2025-04-07T14:00:00Z"},
	{"issue-odb2-1", "user-odb-pm2", "created", "Issue oluşturuldu", "2025-04-01T09:00:00Z"},
	{"issue-odb2-4", "user-odb-w4", "status_change", `Durum "In Review" → "Done" olarak değiştirildi`, "2025-04-07T16:00:00Z"},
	{"issue-bigd2-4", "user-bigd-w4", "status_change", `Durum "In Review" → "Done" olarak değiştirildi`, "2025-04-09T15:00:00Z"},
	{"issue-odb1-1", "user-odb-pm", "assignment", "Deniz Yıldız'a atandı", "2025-04-01T09:30:00Z"},
}

type inventorySeed struct {
	projectKey, name, unit string
	quantity               int
}

var inventoryItems = []inventorySeed{
	{"project-bigd-1", "Ethernet Kablosu", "metre", 100},
	{"project-bigd-1", "RJ45 Konnektör", "adet", 200},
	{"project-bigd-1", "Patch Panel", "adet", 10},
	{"project-bigd-1", "Fiber Optik Kablo", "metre", 50},
	{"project-bigd-1", "Network Switch", "adet", 5},
}

// ─── seeding logic ───────────────────────────────────────────────────────

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	var existing int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM units").Scan(&existing); err != nil {
		log.Fatalf("check existing data: %v", err)
	}
	if existing > 0 {
		log.Println("units table is not empty — already seeded, nothing to do")
		return
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	unitIDs := map[string]uuid.UUID{}
	userIDs := map[string]uuid.UUID{}
	projectIDs := map[string]uuid.UUID{}
	sprintIDs := map[string]uuid.UUID{}
	issueIDs := map[string]uuid.UUID{}
	passwordHashes := map[string]string{}

	hashPassword := func(plain string) string {
		if h, ok := passwordHashes[plain]; ok {
			return h
		}
		h, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("hash password: %v", err)
		}
		passwordHashes[plain] = string(h)
		return string(h)
	}

	// units (department_head_id filled in after users are inserted)
	for _, u := range units {
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO units (name, unit_code, created_at) VALUES ($1, $2, $3) RETURNING id`,
			u.name, u.unitCode, mustTime(u.createdAt),
		).Scan(&id)
		if err != nil {
			log.Fatalf("insert unit %s: %v", u.key, err)
		}
		unitIDs[u.key] = id
	}

	// users (project_id filled in after projects are inserted)
	for _, u := range users {
		var unitID *uuid.UUID
		if u.unitKey != "" {
			id := unitIDs[u.unitKey]
			unitID = &id
		}
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO users (name, email, password_hash, role, unit_id, avatar_color)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			u.name, u.email, hashPassword(u.password), u.role, unitID, u.avatarColor,
		).Scan(&id)
		if err != nil {
			log.Fatalf("insert user %s: %v", u.key, err)
		}
		userIDs[u.key] = id
	}

	// projects
	for _, p := range projects {
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO projects (key, name, description, unit_id, manager_id, has_inventory, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			p.jiraKey, p.name, p.description, unitIDs[p.unitKey], userIDs[p.managerKey], p.hasInventory, mustTime(p.createdAt),
		).Scan(&id)
		if err != nil {
			log.Fatalf("insert project %s: %v", p.name, err)
		}
		projectIDs[p.seedKey] = id
	}

	// backfill users.project_id
	for _, u := range users {
		if u.projectKey == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE users SET project_id = $1 WHERE id = $2`, projectIDs[u.projectKey], userIDs[u.key]); err != nil {
			log.Fatalf("backfill user project %s: %v", u.key, err)
		}
	}

	// backfill units.department_head_id
	for _, u := range units {
		if _, err := tx.Exec(ctx, `UPDATE units SET department_head_id = $1 WHERE id = $2`, userIDs[u.deptHeadKey], unitIDs[u.key]); err != nil {
			log.Fatalf("backfill unit dept head %s: %v", u.key, err)
		}
	}

	// sprints
	for _, s := range sprints {
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO sprints (project_id, name, month, year, start_date, end_date, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			projectIDs[s.projectKey], s.name, s.month, s.year, mustTime(s.startDate), mustTime(s.endDate), s.status,
		).Scan(&id)
		if err != nil {
			log.Fatalf("insert sprint %s: %v", s.key, err)
		}
		sprintIDs[s.key] = id
	}

	// issues
	for _, i := range issues {
		var sprintID *uuid.UUID
		if i.sprintKey != "" {
			id := sprintIDs[i.sprintKey]
			sprintID = &id
		}
		var assigneeID *uuid.UUID
		if i.assigneeKey != "" {
			id := userIDs[i.assigneeKey]
			assigneeID = &id
		}
		var resolvedAt *time.Time
		if i.resolvedAt != "" {
			t := mustTime(i.resolvedAt)
			resolvedAt = &t
		}
		var id uuid.UUID
		err := tx.QueryRow(ctx,
			`INSERT INTO issues (number, project_id, sprint_id, title, description, type, priority, status,
			                     assignee_id, reporter_id, is_request, time_spent, created_at, updated_at, resolved_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
			i.number, projectIDs[i.projectKey], sprintID, i.title, i.description, i.itype, i.priority, i.status,
			assigneeID, userIDs[i.reporterKey], i.isRequest, i.timeSpent, mustTime(i.createdAt), mustTime(i.updatedAt), resolvedAt,
		).Scan(&id)
		if err != nil {
			log.Fatalf("insert issue %s: %v", i.key, err)
		}
		issueIDs[i.key] = id

		for _, visibleKey := range i.visibleTo {
			if _, err := tx.Exec(ctx, `INSERT INTO issue_visible_users (issue_id, user_id) VALUES ($1, $2)`, id, userIDs[visibleKey]); err != nil {
				log.Fatalf("insert visible user for %s: %v", i.key, err)
			}
		}
	}

	// comments
	for _, c := range comments {
		if _, err := tx.Exec(ctx,
			`INSERT INTO comments (issue_id, author_id, text, created_at) VALUES ($1,$2,$3,$4)`,
			issueIDs[c.issueKey], userIDs[c.authorKey], c.text, mustTime(c.createdAt),
		); err != nil {
			log.Fatalf("insert comment on %s: %v", c.issueKey, err)
		}
	}

	// activities
	for _, a := range activities {
		if _, err := tx.Exec(ctx,
			`INSERT INTO activities (issue_id, user_id, type, description, created_at) VALUES ($1,$2,$3,$4,$5)`,
			issueIDs[a.issueKey], userIDs[a.userKey], a.atype, a.description, mustTime(a.createdAt),
		); err != nil {
			log.Fatalf("insert activity on %s: %v", a.issueKey, err)
		}
	}

	// inventory
	for _, inv := range inventoryItems {
		if _, err := tx.Exec(ctx,
			`INSERT INTO inventory (project_id, name, quantity, unit) VALUES ($1,$2,$3,$4)`,
			projectIDs[inv.projectKey], inv.name, inv.quantity, inv.unit,
		); err != nil {
			log.Fatalf("insert inventory %s: %v", inv.name, err)
		}
	}

	// set next_issue_number per project so future issue creation continues the sequence
	if _, err := tx.Exec(ctx, `
		UPDATE projects SET next_issue_number = sub.max_number + 1
		FROM (SELECT project_id, MAX(number) AS max_number FROM issues GROUP BY project_id) sub
		WHERE projects.id = sub.project_id
	`); err != nil {
		log.Fatalf("set next_issue_number: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("commit: %v", err)
	}

	log.Printf("seeded %d units, %d users, %d projects, %d sprints, %d issues, %d comments, %d activities, %d inventory items",
		len(units), len(users), len(projects), len(sprints), len(issues), len(comments), len(activities), len(inventoryItems))
}
