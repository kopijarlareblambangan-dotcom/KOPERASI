'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(n || 0)
const ROLE = { admin: 'Admin', bendahara: 'Bendahara', pengurus: 'Pengurus', pengawas: 'Pengawas', anggota: 'Anggota' }
const JENIS = ['wajib', 'pokok', 'sukarela', 'penyertaan']
const ALOKASI = [['Dana Cadangan', 30], ['Anggota (sebanding jasa usaha)', 50], ['Dana Pengurus & Pengawas', 10], ['Dana Pegawai / Karyawan', 5], ['Dana Sosial', 2.5], ['Dana Pendidikan Perkoperasian', 2.5]]
const LABEL = { lr25: 'SHU Des 2025', nr25: 'Neraca Des 2025', lr26: 'SHU Jan–Jun 2026', nr26: 'Neraca Jan–Jun 2026' }

async function ambilSemua(tabel, urut) {
  let semua = [], dari = 0
  for (;;) {
    const { data, error } = await supabase.from(tabel).select('*').order(urut).range(dari, dari + 999)
    if (error) throw error
    semua = semua.concat(data)
    if (data.length < 1000) return semua
    dari += 1000
  }
}

function hitung(jurnal, akun, per) {
  const th = per.slice(0, 4), m = {}
  akun.forEach(a => { m[a.kode] = { ...a, s: 0 } })
  jurnal.filter(j => j.tanggal <= per).forEach(j => {
    const a = m[j.akun_kode]
    if (!a) return
    const lr = ['pendapatan', 'beban'].includes(a.kelompok)
    if (lr && j.tanggal.slice(0, 4) !== th) return
    const v = Number(j.debet) - Number(j.kredit)
    a.s += ['aktiva', 'beban'].includes(a.kelompok) ? v : -v
  })
  const by = k => Object.values(m).filter(a => a.kelompok === k && a.s !== 0)
  const sum = l => l.reduce((x, a) => x + a.s, 0)
  return { by, sum }
}

function Seksi({ judul, items, total, label }) {
  return <>
    <tr><td colSpan={2} className="sec">{judul}</td></tr>
    {items.map(a => <tr key={a.kode}><td>{a.kode} — {a.nama}</td><td className="n">{rp(a.s)}</td></tr>)}
    <tr className="tot"><td>{label}</td><td className="n">{rp(total)}</td></tr>
  </>
}

export default function Dashboard() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [view, setView] = useState('beranda')
  const [anggota, setAnggota] = useState([])
  const [simpanan, setSimpanan] = useState([])
  const [err, setErr] = useState('')
  const [lap, setLap] = useState([])
  const [kode, setKode] = useState('lr25')
  const [keg, setKeg] = useState([])
  const [users, setUsers] = useState([])
  const [shu, setShu] = useState(167673826)
  const [akun, setAkun] = useState([])
  const [jurnal, setJurnal] = useState([])
  const [per, setPer] = useState(new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.replace('/')
    const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setMe({ ...p, uid: session.user.id })
    const a = await supabase.from('anggota').select('*').order('no_anggota')
    const s = await supabase.from('simpanan').select('*, anggota(nama, no_anggota)').order('tanggal', { ascending: false })
    if (a.error || s.error) setErr((a.error || s.error).message)
    setAnggota(a.data || [])
    setSimpanan(s.data || [])
    if (p && p.peran !== 'anggota') {
      try {
        setAkun(await ambilSemua('akun', 'kode'))
        setJurnal(await ambilSemua('jurnal', 'id'))
      } catch (x) { setErr(x.message) }
    }
    const l = await supabase.from('laporan_baris').select('*').order('urut')
    setLap(l.data || [])
    const k = await supabase.from('kegiatan').select('*').order('tanggal')
    setKeg(k.data || [])
    if (p?.peran === 'admin') {
      const u = await supabase.from('profiles').select('*').order('nama')
      setUsers(u.data || [])
    }
  }, [router])

  useEffect(() => { load() }, [load])

  if (!me) return <p style={{ padding: 20 }}>Memuat…</p>

  const bisaEdit = ['admin', 'bendahara'].includes(me.peran)
  const total = j => simpanan.filter(x => x.jenis === j).reduce((a, x) => a + Number(x.jumlah), 0)

  async function tambahAnggota(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const no = 'A' + String(anggota.length + 1).padStart(3, '0')
    const { error } = await supabase.from('anggota').insert({ no_anggota: no, nama: f.get('nama'), status: f.get('status') })
    if (error) setErr(error.message); else { e.target.reset(); setErr(''); load() }
  }

  async function tambahSimpanan(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const { error } = await supabase.from('simpanan').insert({
      anggota_id: f.get('anggota_id'), jenis: f.get('jenis'),
      jumlah: Number(f.get('jumlah')), dibuat_oleh: me.uid
    })
    if (error) setErr(error.message); else { e.target.reset(); setErr(''); load() }
  }

  async function tambahKegiatan(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const { error } = await supabase.from('kegiatan').insert({ tanggal: f.get('tanggal'), nama: f.get('nama'), keterangan: f.get('keterangan') })
    if (error) setErr(error.message); else { e.target.reset(); setErr(''); load() }
  }

  async function ubahPeran(id, peran) {
    const { error } = await supabase.from('profiles').update({ peran }).eq('id', id)
    if (error) setErr(error.message); else { setErr(''); load() }
  }

  async function tambahJurnal(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    if (f.get('d') === f.get('k')) return setErr('Akun debet dan kredit tidak boleh sama.')
    const j = Number(f.get('jumlah')), tgl = f.get('tanggal')
    const dasar = { tanggal: tgl, periode: tgl.slice(0, 7), keterangan: f.get('keterangan'), dibuat_oleh: me.uid }
    const { error } = await supabase.from('jurnal').insert([
      { ...dasar, akun_kode: f.get('d'), debet: j, kredit: 0 },
      { ...dasar, akun_kode: f.get('k'), debet: 0, kredit: j }
    ])
    if (error) setErr(error.message); else { e.target.reset(); setErr(''); load() }
  }

  async function keluar() { await supabase.auth.signOut(); router.replace('/') }

  const menu = [['beranda', 'Beranda'], ['laporan', 'Laporan Keuangan'], ['shu', 'Simulasi SHU'], ['anggota', 'Data Anggota'], ['simpanan', 'Simpanan'], ['kegiatan', 'Kegiatan']]
  if (me.peran !== 'anggota') menu.splice(3, 0, ['jurnal', 'Jurnal'], ['otomatis', 'Laporan Otomatis'])
  if (me.peran === 'admin') menu.push(['pengguna', 'Pengguna'])
  const H = view === 'otomatis' ? hitung(jurnal, akun, per) : null
  const namaAkun = Object.fromEntries(akun.map(a => [a.kode, a.nama]))
  const opsi = akun.map(a => <option key={a.kode} value={a.kode}>{a.kode} — {a.nama}</option>)
  const baris = lap.filter(r => r.kode === kode)
  const kodeAda = [...new Set(lap.map(r => r.kode))]
  const pct = (a, b) => (a ? ((b - a) / Math.abs(a) * 100).toFixed(1) + '%' : '–')

  return (
    <div className="app">
      <aside>
        <div className="br">KOPERLIN</div>
        {menu.map(([k, n]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{n}</button>
        ))}
        <div className="me"><b>{me.nama}</b>{ROLE[me.peran]}<br /><button onClick={keluar}>Keluar</button></div>
      </aside>
      <main>
        {err && <p className="err">{err}</p>}

        {view === 'beranda' && <>
          <h1>Selamat datang, {me.nama}</h1>
          <p className="mu">Peran Anda: {ROLE[me.peran]}{bisaEdit ? ' (dapat input data)' : ' (hanya lihat)'}</p>
          <div className="g">
            <div className="k"><span>Jumlah anggota</span><b>{anggota.length}</b></div>
            <div className="k"><span>Simpanan pokok</span><b>{rp(total('pokok'))}</b></div>
            <div className="k"><span>Simpanan wajib</span><b>{rp(total('wajib'))}</b></div>
            <div className="k"><span>Simpanan sukarela</span><b>{rp(total('sukarela'))}</b></div>
          </div>
        </>}

        {view === 'anggota' && <>
          <h1>Data Anggota</h1>
          {bisaEdit && <form className="card f" onSubmit={tambahAnggota}>
            <input name="nama" placeholder="Nama lengkap" required />
            <select name="status"><option value="pegawai">Pegawai</option><option value="pensiunan">Pensiunan</option></select>
            <button className="b">Tambah anggota</button>
          </form>}
          <div className="card sc"><table>
            <thead><tr><th>No.</th><th>Nama</th><th>Status</th><th>Masuk</th></tr></thead>
            <tbody>{anggota.map(a => <tr key={a.id}><td>{a.no_anggota}</td><td>{a.nama}</td><td>{a.status}</td><td>{a.tgl_masuk}</td></tr>)}</tbody>
          </table></div>
        </>}

        {view === 'simpanan' && <>
          <h1>Simpanan</h1>
          {bisaEdit && <form className="card f" onSubmit={tambahSimpanan}>
            <select name="anggota_id" required>{anggota.map(a => <option key={a.id} value={a.id}>{a.no_anggota} — {a.nama}</option>)}</select>
            <select name="jenis">{JENIS.map(j => <option key={j}>{j}</option>)}</select>
            <input name="jumlah" type="number" min="1" placeholder="Jumlah (Rp)" required />
            <button className="b">Simpan</button>
          </form>}
          <div className="card sc"><table>
            <thead><tr><th>Tanggal</th><th>Anggota</th><th>Jenis</th><th className="n">Jumlah</th></tr></thead>
            <tbody>{simpanan.map(s => <tr key={s.id}><td>{s.tanggal}</td><td>{s.anggota?.nama}</td><td>{s.jenis}</td><td className="n">{rp(s.jumlah)}</td></tr>)}</tbody>
          </table></div>
        </>}

        {view === 'laporan' && <>
          <h1>Laporan Keuangan</h1>
          <div className="f" style={{ marginBottom: 12 }}>
            {kodeAda.map(k => <button key={k} className={kode === k ? 'b' : 'b o'} onClick={() => setKode(k)}>{LABEL[k] || k}</button>)}
            <button className="b o" onClick={() => window.print()}>Cetak / PDF</button>
          </div>
          <div className="card sc">
            <h2>{baris[0]?.judul}</h2>
            {baris.length === 0 ? <p className="mu">Belum ada data. Jalankan supabase_tahap_b.sql.</p> : <table>
              <thead><tr><th>Uraian</th><th className="n">{baris[0].kol_a}</th><th className="n">{baris[0].kol_b}</th><th className="n">Δ</th></tr></thead>
              <tbody>{baris.map(r => r.tipe === 'h'
                ? <tr key={r.id}><td colSpan={4} className="sec">{r.uraian}</td></tr>
                : <tr key={r.id} className={r.tipe === 't' ? 'tot' : ''}><td>{r.uraian}</td><td className="n">{rp(r.a)}</td><td className="n">{rp(r.b)}</td><td className="n">{pct(Number(r.a), Number(r.b))}</td></tr>)}</tbody>
            </table>}
          </div>
        </>}

        {view === 'jurnal' && <>
          <h1>Jurnal</h1>
          <p className="mu">Setiap transaksi dicatat sebagai pasangan debet dan kredit, sehingga selalu seimbang.</p>
          {bisaEdit && <form className="card f" onSubmit={tambahJurnal}>
            <input name="tanggal" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            <select name="d" required><option value="">Debet: pilih akun</option>{opsi}</select>
            <select name="k" required><option value="">Kredit: pilih akun</option>{opsi}</select>
            <input name="jumlah" type="number" min="1" placeholder="Jumlah (Rp)" required />
            <input name="keterangan" placeholder="Keterangan" style={{ flex: 1, minWidth: 160 }} required />
            <button className="b">Catat</button>
          </form>}
          <div className="card sc"><table>
            <thead><tr><th>Tanggal</th><th>Akun</th><th className="n">Debet</th><th className="n">Kredit</th><th>Keterangan</th></tr></thead>
            <tbody>{[...jurnal].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 100).map(j => <tr key={j.id}><td>{j.tanggal}</td><td>{j.akun_kode} — {namaAkun[j.akun_kode]}</td><td className="n">{Number(j.debet) ? rp(j.debet) : ''}</td><td className="n">{Number(j.kredit) ? rp(j.kredit) : ''}</td><td>{j.keterangan}</td></tr>)}</tbody>
          </table></div>
          <p className="mu">Menampilkan 100 entri terbaru.</p>
        </>}

        {view === 'otomatis' && H && (() => {
          const pend = H.by('pendapatan'), beb = H.by('beban'), shuB = H.sum(pend) - H.sum(beb)
          const akt = H.by('aktiva'), kew = H.by('kewajiban'), eku = H.by('ekuitas')
          const tA = H.sum(akt), tK = H.sum(kew), tE = H.sum(eku) + shuB
          return <>
            <h1>Laporan Otomatis</h1>
            <p className="mu">Dihitung dari jurnal. Laba-rugi untuk tahun berjalan sampai tanggal di bawah, neraca kumulatif.</p>
            <div className="card f"><span>Per tanggal</span><input type="date" value={per} onChange={e => setPer(e.target.value)} /><button className="b o" onClick={() => window.print()}>Cetak / PDF</button></div>
            <div className="card sc"><table><tbody>
              <Seksi judul="PENDAPATAN" items={pend} total={H.sum(pend)} label="Jumlah pendapatan" />
              <Seksi judul="BEBAN" items={beb} total={H.sum(beb)} label="Jumlah beban" />
              <tr className="tot"><td>SHU TAHUN BERJALAN (sebelum PPh jika belum dijurnal)</td><td className="n">{rp(shuB)}</td></tr>
            </tbody></table></div>
            <div className="card sc"><table><tbody>
              <Seksi judul="AKTIVA" items={akt} total={tA} label="TOTAL AKTIVA" />
              <Seksi judul="KEWAJIBAN" items={kew} total={tK} label="Jumlah kewajiban" />
              <Seksi judul="KEKAYAAN BERSIH" items={[...eku, { kode: '—', nama: 'SHU tahun berjalan', s: shuB }]} total={tE} label="Jumlah kekayaan bersih" />
              <tr className="tot"><td>TOTAL KEWAJIBAN & KEKAYAAN</td><td className="n">{rp(tK + tE)}</td></tr>
            </tbody></table>
            {tA - (tK + tE) !== 0 && <p className="err">Neraca belum seimbang (selisih {rp(tA - tK - tE)}). Periksa jurnal atau saldo awal.</p>}
            </div>
          </>
        })()}

        {view === 'shu' && <>
          <h1>Simulasi Pembagian SHU</h1>
          <p className="mu">Persentase mengikuti AD Pasal 43 dan ART Pasal 38.</p>
          <div className="card">
            <div className="f" style={{ marginBottom: 12 }}><input type="number" value={shu} onChange={e => setShu(Number(e.target.value))} /></div>
            <div className="sc"><table>
              <thead><tr><th>Peruntukan</th><th className="n">%</th><th className="n">Jumlah</th></tr></thead>
              <tbody>{ALOKASI.map(([n, p]) => <tr key={n}><td>{n}</td><td className="n">{p}%</td><td className="n">{rp(Math.round(shu * p / 100))}</td></tr>)}
                <tr className="tot"><td>Total</td><td className="n">100%</td><td className="n">{rp(shu)}</td></tr></tbody>
            </table></div>
            <p className="mu">Pembagian per anggota (50%) mengikuti Peraturan Khusus koperasi, yang akan kita tambahkan di tahap berikutnya.</p>
          </div>
        </>}

        {view === 'kegiatan' && <>
          <h1>Kegiatan & Agenda</h1>
          {['admin', 'pengurus'].includes(me.peran) && <form className="card f" onSubmit={tambahKegiatan}>
            <input name="tanggal" type="date" required />
            <input name="nama" placeholder="Nama kegiatan" required />
            <input name="keterangan" placeholder="Keterangan" style={{ flex: 1, minWidth: 180 }} />
            <button className="b">Tambah</button>
          </form>}
          {keg.map(k => <div className="card" key={k.id}><span className="mu">{k.tanggal}</span><h2>{k.nama}</h2><p className="mu">{k.keterangan}</p></div>)}
        </>}

        {view === 'pengguna' && <>
          <h1>Manajemen Pengguna</h1>
          <p className="mu">Pengguna baru dibuat di Supabase (Authentication → Users), lalu atur perannya di sini.</p>
          <div className="card sc"><table>
            <thead><tr><th>Nama</th><th>Peran</th></tr></thead>
            <tbody>{users.map(u => <tr key={u.id}><td>{u.nama}</td><td>
              <select value={u.peran} onChange={e => ubahPeran(u.id, e.target.value)}>
                {Object.entries(ROLE).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select></td></tr>)}</tbody>
          </table></div>
        </>}
      </main>
    </div>
  )
}
