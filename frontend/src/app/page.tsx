"use client";

import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

type Player = {
  id: string;
  nickname: string;
};

export default function HomePage() {
  const [nickname, setNickname] = useState("");
  const [lobbyId, setLobbyId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentLobby, setCurrentLobby] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [word, setWord] = useState("");
  const [hostId, setHostId] = useState<string | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, string | null>>({});
  const [note, setNote] = useState("");


  useEffect(() => {
    socket.on("connect", () => {
      if (socket.id) {
        setMySocketId(socket.id);
      }
    });

    socket.on("lobby_created", ({ lobbyId }) => {
      setCurrentLobby(lobbyId);
    });

    socket.on("lobby_update", (lobby) => {
      setPlayers(lobby.players);
      setHostId(lobby.hostId);
    });

    socket.on("game_started", (assignments) => {
      setAssignments(assignments);
    });

    socket.on("words_update", (words) => {
      setWords(words);
    });

    socket.on("game_restarted", (assignments) => {
      setAssignments(assignments);
      setWord("");
    });

    return () => {
      socket.off("connect");
      socket.off("lobby_created");
      socket.off("lobby_update");
      socket.off("game_started");
      socket.off("words_update");
      socket.off("game_restarted");
    };
  }, []);

  useEffect(() => {
    if (!currentLobby) return;

    const saved = localStorage.getItem(`note:${currentLobby}`);
    if (saved) {
      setNote(saved);
    }
  }, [currentLobby]);


  function createLobby() {
    if (!nickname) return alert("Введите ник");
    socket.emit("create_lobby", { nickname });
  }

  function joinLobby() {
    if (!nickname || !lobbyId) return alert("Введите ник и ID");
    socket.emit("join_lobby", { lobbyId, nickname });
    setCurrentLobby(lobbyId);
  }

  function startGame() {
    socket.emit("start_game", { lobbyId: currentLobby });
  }

  function submitWord() {
    socket.emit("set_word", { lobbyId: currentLobby, word });
    setWord("");
  }

  function saveNote(value: string) {
    setNote(value);
    if (currentLobby) {
      localStorage.setItem(`note:${currentLobby}`, value);
    }
  }

  function restartGame() {
    socket.emit("restart_game", { lobbyId: currentLobby });
  }

  const myTargetId = mySocketId ? assignments[mySocketId] : undefined;
  const myTarget = players.find(p => p.id === myTargetId);

  return (
    <main style={{ padding: 40 }}>
      <h1>Игра «Кто я?»</h1>

      {!currentLobby && (
        <>
          <input placeholder="Ник" value={nickname} onChange={e => setNickname(e.target.value)} />
          <br /><br />
          <button onClick={createLobby}>Создать лобби</button>
          <br /><br />
          <input placeholder="ID лобби" value={lobbyId} onChange={e => setLobbyId(e.target.value)} />
          <button onClick={joinLobby}>Войти</button>
        </>
      )}

      {currentLobby && (
        <>
          <h2>Лобби: {currentLobby}</h2>

          <div className="block">
            <h3>Игроки</h3>

            <div className="players">
              {players.map(p => (
                <div key={p.id} className="player-card">
                  <div className="player-name">{p.nickname}</div>

                  {words[p.id] !== undefined && (
                    <div>
                      {words[p.id] === null ? (
                        <span className="word-hidden">???</span>
                      ) : (
                        <b>{words[p.id]}</b>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="block controls">
            {mySocketId === hostId && (
              <>
                <button className="primary" onClick={startGame}>
                  ▶ НАЧАТЬ ИГРУ
                </button>

                <button className="secondary" onClick={restartGame}>
                  🔄 РЕСТАРТ
                </button>
              </>
            )}
          </div>

          {myTarget && (
            <div className="block">
              <h3>Ты загадываешь для: {myTarget.nickname}</h3>

              <input
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="Введи слово"
              />

              <button
                className="primary"
                style={{ marginTop: 10 }}
                onClick={submitWord}
              >
                Сохранить слово
              </button>
            </div>
          )}

          <div className="block">
            <h3>Мои заметки</h3>

            <textarea
              value={note}
              onChange={e => saveNote(e.target.value)}
              rows={6}
              placeholder="Пиши свои догадки тут..."
            />
          </div>
        </>
      )}
    </main>
  );
}
