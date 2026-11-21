'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(n || 0)
const ROLE = { admin: 'Admin', bendahara: 'Bendahara', pengurus: 'Pengurus', pengawas: 'Pengawas', anggota: 'Anggota' }
const JENIS = ['wajib', 'pokok', 'sukarela', 'penyertaan']

export default function Dashboard() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [view, setView] = useState('beranda')
  const [anggota, setAnggota] = useState([])
  const [simpanan, setSimpanan] = useState([])
  const [err, setErr] = useState('')

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

  async function keluar() { await supabase.auth.signOut(); router.replace('/') }

  const menu = [['beranda', 'Beranda'], ['anggota', 'Data Anggota'], ['simpanan', 'Simpanan']]

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
      </main>
    </div>
  )
}
