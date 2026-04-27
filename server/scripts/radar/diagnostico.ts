import * as fs from 'node:fs'
import { JSDOM } from 'jsdom'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

async function tentarUrl(label: string, urlStr: string) {
  console.log(`\n========== ${label} ==========`)
  console.log('URL:', urlStr)

  const resp = await fetch(urlStr, { headers: HEADERS, redirect: 'follow' })
  console.log('Status:', resp.status, '| Final URL:', resp.url)

  const html = await resp.text()
  console.log('Tamanho HTML:', html.length)

  fs.mkdirSync('tmp', { recursive: true })
  const fname = `tmp/dou_${label.replace(/[^a-z0-9]/gi, '_')}.html`
  fs.writeFileSync(fname, html)
  console.log('HTML salvo em:', fname)

  const dom = new JSDOM(html)
  const doc = dom.window.document

  const ps = doc.querySelector('script#params')
  if (!ps) {
    console.log('❌ NAO TEM script#params')
    const todos = doc.querySelectorAll('script[type="application/json"]')
    console.log(`   Outros scripts application/json: ${todos.length}`)
    todos.forEach((s, i) =>
      console.log(`   [${i}] id="${s.id}" len=${s.textContent?.length}`),
    )
  } else {
    console.log('✅ TEM script#params, tamanho:', ps.textContent?.length)
    try {
      const j = JSON.parse(ps.textContent || '{}') as Record<string, unknown>
      console.log('   Keys:', Object.keys(j))
      console.log('   typeof jsonArray:', typeof j.jsonArray)
      console.log('   Array.isArray:', Array.isArray(j.jsonArray))

      let inner: unknown = j.jsonArray
      if (typeof inner === 'string') {
        console.log('   jsonArray é STRING, fazendo parse aninhado...')
        console.log('   primeiros 300 chars:', inner.slice(0, 300))
        try {
          inner = JSON.parse(inner)
          console.log('   ✅ Parse aninhado OK')
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.log('   ❌ Erro parse aninhado:', msg)
        }
      }

      console.log(
        '   keys de jsonArray:',
        inner && typeof inner === 'object'
          ? Object.keys(inner as object).slice(0, 20)
          : 'N/A',
      )
      console.log(
        '   Array? len:',
        Array.isArray(inner) ? inner.length : 'não é array',
      )

      if (Array.isArray(inner) && inner[0]) {
        console.log('   ESTRUTURA DO 1º ITEM:')
        const firstEl = inner[0]
        console.log(
          '   Keys:',
          firstEl && typeof firstEl === 'object' ? Object.keys(firstEl) : typeof firstEl,
        )
        console.log('   1º item completo:', JSON.stringify(inner[0], null, 2))

        function hierarqLower(it: unknown): string {
          if (!it || typeof it !== 'object') return ''
          const o = it as Record<string, unknown>
          return String(o.hierarchyStr ?? o.hierarchy ?? '').toLowerCase()
        }
        const dosAnm = inner.filter((it) => {
          const h = hierarqLower(it)
          return h.includes('mineração') || h.includes('mineracao')
        })
        console.log(
          `   Itens com 'mineração' em hierarchy: ${dosAnm.length}`,
        )
        if (dosAnm[0]) {
          const a = dosAnm[0] as Record<string, unknown>
          console.log('   1º ANM hierarchyStr:', a.hierarchyStr ?? a.hierarchy)
          console.log('   1º ANM urlTitle:', a.urlTitle)
        }
      }

      const candidatos = ['items', 'value', 'data', 'results', 'list'] as const
      const innerObj =
        inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : null
      for (const k of candidatos) {
        if (innerObj?.[k]) {
          const v = innerObj[k]
          console.log(
            `   inner.${k}: ${Array.isArray(v) ? `${v.length} items` : typeof v}`,
          )
          if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && v[0] !== null) {
            const z = v[0] as Record<string, unknown>
            console.log(`   1º urlTitle:`, (z.urlTitle as string) ?? 'N/A')
          }
        }
      }

      const matches = html.match(/"urlTitle"\s*:\s*"([^"]+)"/g) || []
      console.log('   urlTitles via regex no HTML:', matches.length)
      if (matches.length > 0) {
        console.log('   Primeiros 3:', matches.slice(0, 3))
      }

      console.log('   totalArquivos:', j.totalArquivos)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log('   ERRO parse JSON:', msg)
    }
  }

  console.log('\n--- Sinais ---')
  console.log('   "urlTitle" no HTML:', html.includes('urlTitle'))
  console.log(
    '   "react" / "vue":',
    html.toLowerCase().includes('react') || html.toLowerCase().includes('vue'),
  )
  console.log('   "noscript":', html.includes('<noscript'))
  console.log(
    '   "captcha" / "blocked":',
    html.toLowerCase().includes('captcha') || html.toLowerCase().includes('blocked'),
  )
}

;(async () => {
  const data = '27-04-2026'
  const u1 = new URL('https://www.in.gov.br/leiturajornal')
  u1.searchParams.set('data', data)
  u1.searchParams.set('secao', 'do1')
  u1.searchParams.set('org', 'Ministério de Minas e Energia')
  u1.searchParams.set('org_sub', 'Agência Nacional de Mineração')
  await tentarUrl('A_searchParams', u1.toString())
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
