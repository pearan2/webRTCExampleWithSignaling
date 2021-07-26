import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

import Video from "./Video";

interface OfferAnswerDto {
  fromClientId: string;
  toClientId: string;
  sdp: RTCSessionDescriptionInit;
}

interface IceDto {
  fromClientId: string;
  toClientId: string;
  ice: RTCIceCandidate;
}

class Peer extends RTCPeerConnection {
  connectedClientSocketId: string;
  socketId: string;
  remoteStreams: MediaStream[];
  constructor(
    connectedClientSocketId: string,
    socketId: string,
    pcConfig?: RTCConfiguration
  ) {
    super(pcConfig);
    this.connectedClientSocketId = connectedClientSocketId;
    this.socketId = socketId;
    this.remoteStreams = [];
  }
}

class PeerManager {
  static Config: RTCConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };
  peers: Map<string, Peer>;
  socket: Socket;
  setPeers: React.Dispatch<React.SetStateAction<Peer[]>>;
  localStream: MediaStream;
  pcConfig: RTCConfiguration | undefined;
  constructor(
    socket: Socket,
    localStream: MediaStream,
    setPeers: React.Dispatch<React.SetStateAction<Peer[]>>,
    pcConfig?: RTCConfiguration,
    roomId?: string
  ) {
    this.localStream = localStream;
    this.socket = socket;
    this.setPeers = setPeers;
    if (pcConfig) this.pcConfig = pcConfig;
    else this.pcConfig = PeerManager.Config;
    this.peers = new Map();

    socket.on("offer", (offerDto: OfferAnswerDto) => {
      if (!this.peers.has(offerDto.fromClientId)) {
        this.createPeerWithEventSetting(
          offerDto.fromClientId,
          offerDto.toClientId
        );
      }
      const offeredPeer = this.peers.get(offerDto.fromClientId)!;
      offeredPeer.setRemoteDescription(offerDto.sdp);
      offeredPeer
        .createAnswer()
        .then((sdp) => {
          offeredPeer.setLocalDescription(sdp);
          const answerDto: OfferAnswerDto = {
            fromClientId: offeredPeer.socketId,
            toClientId: offeredPeer.connectedClientSocketId,
            sdp: sdp,
          };
          this.socket.emit("answer", answerDto);
        })
        .catch((error) => {
          console.error(
            `Peer SocketId: ${
              offeredPeer.connectedClientSocketId
            } createAnswer fail=> ${error.toString()}`
          );
        });
    });

    socket.on("needToOffer", (toSocketIds: string[]) => {
      toSocketIds.forEach((connectedSocketId) => {
        if (connectedSocketId !== this.socket.id) {
          const newPeer = this.createPeerWithEventSetting(
            connectedSocketId,
            this.socket.id
          );
          newPeer
            .createOffer()
            .then((sdp) => {
              newPeer.setLocalDescription(sdp);
              const offerDto: OfferAnswerDto = {
                toClientId: newPeer.connectedClientSocketId,
                fromClientId: newPeer.socketId,
                sdp: sdp,
              };
              this.socket.emit("offer", offerDto);
            })
            .catch((error) => {
              console.error(
                `Peer SocketId: ${
                  newPeer.connectedClientSocketId
                } createAnswer fail=> ${error.toString()}`
              );
            });
        }
      });
    });

    this.socket.on("answer", (answerDto: OfferAnswerDto) => {
      const answeredPeer = this.peers.get(answerDto.fromClientId);
      if (answeredPeer) {
        answeredPeer.setRemoteDescription(answerDto.sdp);
      }
    });

    this.socket.on("ice", (iceDto: IceDto) => {
      const icedPeer = this.peers.get(iceDto.fromClientId);
      if (icedPeer) {
        icedPeer
          .addIceCandidate(new RTCIceCandidate(iceDto.ice))
          .catch((error) => {
            console.error(`addIceCandidate Fail : ${error.toString()}`);
          });
      }
    });

    socket.emit("joinRoom", roomId || "honleeExample");
  }
  createPeerWithEventSetting(
    connectedClientSocketId: string,
    socketId: string
  ): Peer {
    const newPeer = new Peer(connectedClientSocketId, socketId, this.pcConfig);
    this.localStream.getTracks().forEach((track) => {
      newPeer.addTrack(track, this.localStream);
    });

    this.setPeers((prev) => {
      return [...prev, newPeer];
    });
    this.peers.set(connectedClientSocketId, newPeer);

    newPeer.addEventListener("icecandidate", (event) => {
      const iceCandidate = event.candidate;
      if (iceCandidate) {
        const iceDto: IceDto = {
          toClientId: newPeer.connectedClientSocketId,
          fromClientId: newPeer.socketId,
          ice: iceCandidate,
        };
        this.socket.emit("ice", iceDto);
      }
    });
    newPeer.addEventListener("track", (event) => {
      newPeer.remoteStreams = event.streams.concat();
    });
    newPeer.addEventListener("connectionstatechange", (event) => {
      const targetPeer = event.target as Peer;
      if (
        targetPeer.connectionState === "closed" ||
        targetPeer.connectionState === "disconnected" ||
        targetPeer.connectionState === "failed"
      ) {
        this.peers.delete(targetPeer.connectedClientSocketId);
        this.setPeers((prev) => {
          return prev.filter((peer) => {
            return (
              peer.connectedClientSocketId !==
              targetPeer.connectedClientSocketId
            );
          });
        });
      } else if (targetPeer.connectionState === "connected") {
        this.setPeers((prev) => {
          return prev.concat();
        });
      }
    });
    return newPeer;
  }
}

const App = () => {
  const [peers, setPeers] = useState<Peer[]>([]);
  const localStream = useRef<MediaStream | null>(null);
  const peerManager = useRef<PeerManager | null>(null);

  useEffect(() => {
    if (localStream.current) return;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream: MediaStream) => {
        localStream.current = stream;
        const socket = io("http://localhost:8080");
        peerManager.current = new PeerManager(
          socket,
          stream,
          setPeers,
          PeerManager.Config
        );
      })
      .catch((error) => {
        console.error(`getUserMedia() Error : ${error.toString()}`);
      });
  }, []);

  return (
    <>
      {peers.map((peer) => {
        return (
          <Video
            key={peer.connectedClientSocketId}
            stream={peer.remoteStreams[0]}
          ></Video>
        );
      })}
    </>
  );
};

export default App;
