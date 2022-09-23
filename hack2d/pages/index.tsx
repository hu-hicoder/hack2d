import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import styles from '../styles/Home.module.css'

export default function Home() {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')

  const joinRoom = (event: any) => {
    event.preventDefault()
    router.push(`/room/${roomName || Math.random().toString(36).slice(2)}`)
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>hack2d</title>
        <meta name="description" content="Use Native WebRTC API for video conferencing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 style={{fontSize: '2em'}}>ようこそ hack2d へ！</h1>
        <form onSubmit={joinRoom}>
          <label>
            <input style={{fontSize: '1.2em'}} type='text' placeholder='hack2d' onChange={(e: any) => setRoomName(e.target.value)} value={roomName} className={styles['room-name']} />
          </label>
          <input style={{ fontSize: '1.2em' }} type="submit" value='参加'/>
        </form>
      </main>
    </div>
  )
}
