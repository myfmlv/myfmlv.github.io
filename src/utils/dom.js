export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderTableState(tbody, message, options = {}) {
  if (!tbody) return

  const colSpan = options.colSpan || 9
  const tone = options.tone || 'muted'

  tbody.innerHTML = `
    <tr class="table-state table-state--${escapeHtml(tone)}">
      <td colspan="${colSpan}">
        ${escapeHtml(message)}
      </td>
    </tr>
  `
}
