package services

// Permission keys. Every action a role can be allowed to perform has one; the
// handlers check these instead of hardcoding role names.
const (
	PermIssueCreate     = "issue.create"
	PermRequestCreate   = "request.create"
	PermIssueEdit       = "issue.edit"
	PermIssueDelete     = "issue.delete"
	PermIssueStatus     = "issue.status"
	PermIssueAssign     = "issue.assign"
	PermIssueClone      = "issue.clone"
	PermIssueSprint     = "issue.sprint"
	PermIssueDates      = "issue.dates"
	PermIssueShare      = "issue.share"
	PermSprintManage    = "sprint.manage"
	PermInventoryManage = "inventory.manage"
	PermInventoryUse    = "inventory.use"
	PermProjectCreate   = "project.create"
	PermProjectEdit     = "project.edit"
	PermUnitManage      = "unit.manage"
	PermRoleManage      = "role.manage"
	PermIssueForward    = "issue.forward"
	PermHelpdeskCreate  = "helpdesk.create"
	PermTeamManage      = "team.manage"
	PermTemplateManage  = "template.manage"
	PermAssignUserRole  = "user.assign_role"
	PermRequestForm     = "request_form.manage"
	PermIssueApprove    = "issue.approve"
)

type PermissionInfo struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Group       string `json:"group"`
	Description string `json:"description"`
}

// PermissionCatalog is the fixed list shown in the role editor.
var PermissionCatalog = []PermissionInfo{
	{PermRequestCreate, "Talep aç", "Talepler", "Yeni talep oluşturabilir"},
	{PermIssueClone, "Talep/iş klonla", "Talepler", "Bir talebi veya işi kopyalayabilir"},
	{PermIssueShare, "Talebi kullanıcıya görünür yap", "Talepler", "Dış kullanıcıya talep görünürlüğü verebilir"},
	{PermIssueCreate, "İş oluştur", "İşler", "Yeni iş (görev, hata…) oluşturabilir"},
	{PermIssueEdit, "İş/talep düzenle", "İşler", "Başlık, açıklama ve öncelik gibi alanları düzenleyebilir"},
	{PermIssueDelete, "İş/talep sil", "İşler", "İş veya talebi silebilir"},
	{PermIssueStatus, "Durum değiştir", "İşler", "İşin durumunu değiştirebilir ve tamamlayabilir"},
	{PermIssueAssign, "Atama yap", "İşler", "İşi bir çalışana atayabilir veya atamayı değiştirebilir"},
	{PermIssueApprove, "Tamamlamayı onayla", "İşler", "İşleri doğrudan kapatabilir ve başkalarının tamamladığı işleri onaylayıp reddedebilir; bu izni olmayanların tamamladığı işler onaya düşer"},
	{PermIssueDates, "Tarih/süre düzenle", "İşler", "Çözüm tarihi ve harcanan süreyi düzenleyebilir"},
	{PermIssueSprint, "Aya/bekleyen taleplere taşı", "İşler", "İşi bir aya atayabilir veya bekleyen taleplere alabilir"},
	{PermIssueForward, "Talebi yönlendir", "Talepler", "Talebi başka bir müdürlüğe/daire başkanlığına yönlendirebilir"},
	{PermHelpdeskCreate, "Başkası adına talep aç", "Talepler", "Telefon/yüz yüze gelen biri için onun adına talep açabilir"},
	{PermSprintManage, "Aylık dönem yönet", "Müdürlükler", "Aylık dönem oluşturabilir, başlatabilir ve kapatabilir"},
	{PermTeamManage, "Ekip yönet", "Müdürlükler", "Ekip oluşturabilir ve üyelerini düzenleyebilir"},
	{PermTemplateManage, "Cevap şablonu yönet", "Müdürlükler", "Hazır yanıt şablonları oluşturabilir ve düzenleyebilir"},
	{PermRequestForm, "Talep formu yönet", "Müdürlükler", "Talep açılırken sorulacak müdürlüğe özel soruları hazırlayabilir"},
	{PermProjectCreate, "Müdürlük oluştur", "Müdürlükler", "Yeni müdürlük açabilir"},
	{PermProjectEdit, "Müdürlük düzenle", "Müdürlükler", "Müdürlük bilgilerini ve müdürünü değiştirebilir"},
	{PermInventoryManage, "Envanter yönet", "Envanter", "Envanter kalemi ekleyebilir ve stok düzenleyebilir"},
	{PermInventoryUse, "Envanter kullan", "Envanter", "İş tamamlarken envanterden düşüm yapabilir"},
	{PermUnitManage, "Daire başkanlığı yönet", "Yönetim", "Daire başkanlığı oluşturabilir ve düzenleyebilir"},
	{PermRoleManage, "Rol ve izinleri yönet", "Yönetim", "Rol tanımlarını (izin kümesi, veri kapsamı, seviye) oluşturabilir ve düzenleyebilir"},
	{PermAssignUserRole, "Kullanıcıya rol ata", "Yönetim", "Kendi yönetim alanındaki kullanıcılara, kendi rol seviyesinin altındaki rolleri atayabilir"},
}

func ValidPermission(key string) bool {
	for _, p := range PermissionCatalog {
		if p.Key == key {
			return true
		}
	}
	return false
}

// Can reports whether the authenticated user's role grants the permission.
func (c *Claims) Can(permission string) bool {
	return c.Perms[permission]
}
