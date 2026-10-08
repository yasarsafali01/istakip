/**
 * Fills a template's {Placeholder} tokens from the current issue/user. Shared
 * by reply templates (comment box) and resolution templates (completion note).
 */
export function fillTemplate(body, { issue, project, currentUser, reporterName }) {
  return body
    .replaceAll('{TalepNo}', issue?.key || issue?.number || '')
    .replaceAll('{TalepEdenAdı}', reporterName || '')
    .replaceAll('{MüdürlükAdı}', project?.name || '')
    // Legacy token — templates saved before the Proje → Müdürlük rename still use it
    .replaceAll('{ProjeAdı}', project?.name || '')
    .replaceAll('{BenimAdım}', currentUser?.name || '')
    .replaceAll('{BenimEposta}', currentUser?.email || '');
}
