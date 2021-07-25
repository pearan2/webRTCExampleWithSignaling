import React, { useEffect, useState, useRef } from "react";
import adapter from "webrtc-adapter";
import io from "socket.io-client";
import Video from "./Video";
import { Socket } from "dgram";

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
  remoteStream: MediaStream | null;
  clientId: string;
  constructor(
    config: RTCConfiguration,
    clientId: string,
    localSteam: MediaStream
  ) {
    super(config);
    this.remoteStream = null;
    this.clientId = clientId;
    localSteam.getTracks().forEach((track) => {
      this.addTrack(track, localSteam);
    });
  }
}

const pcConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const mediaStreamConstraints: MediaStreamConstraints = {
  video: true,
  audio: false,
};

function App() {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia(mediaStreamConstraints)
      .then((localStream) => {
        const socket = io("http://localhost:8080");
        socket.on("connect", () => {
          socket.emit("joinRoom", "honleeExampleRoom");
          console.log(`socket connected socketid : ${socket.id}`);
        });
        socket.on("offer", (offerDto: OfferAnswerDto) => {
          console.log("offer", offerDto, peers);
          setPeers((prev) => {
            const newPeer = new Peer(
              pcConfig,
              offerDto.fromClientId,
              localStream
            );
            return prev.concat([newPeer]);
          });
          console.log("setPeers end", peers);

          const offeredPeer = peers.find((peer) => {
            return peer.clientId === offerDto.fromClientId;
          });
          if (offeredPeer) {
            console.log("onOffer", offerDto);
            offeredPeer.setRemoteDescription(offerDto.sdp);
            offeredPeer.createAnswer().then((sdp) => {
              offeredPeer.setLocalDescription(sdp);
              const answerDto: OfferAnswerDto = {
                fromClientId: socket.id,
                toClientId: offeredPeer.clientId,
                sdp: sdp,
              };
              socket.emit("answer", answerDto);
            });
          }
        });

        socket.on("answer", (answerDto: OfferAnswerDto) => {
          const answeredPeer = peers.find((peer) => {
            return peer.clientId === answerDto.fromClientId;
          });
          if (answeredPeer) {
            console.log("onAnswer", answerDto);
            answeredPeer.setRemoteDescription(answerDto.sdp);
          }
        });

        socket.on("ice", (iceDto: IceDto) => {
          const icedPeer = peers.find((peer) => {
            return peer.clientId === iceDto.fromClientId;
          });
          if (icedPeer) {
            console.log("onIce", iceDto);
            icedPeer.addIceCandidate(new RTCIceCandidate(iceDto.ice));
          }
        });

        socket.on("needToOffer", (clientIds: string[]) => {
          console.log("onNeedToOffer", clientIds);
          const newPeers: Peer[] = [];
          clientIds.forEach((clientId) => {
            if (clientId !== socket.id)
              newPeers.push(new Peer(pcConfig, clientId, localStream));
          });
          setPeers([...peers, ...newPeers]);
          console.log("before create offer, map", peers);

          newPeers.forEach((peer) => {
            peer
              .createOffer()
              .then((sdp) => {
                peer.setLocalDescription(sdp);
                const offerdto: OfferAnswerDto = {
                  fromClientId: socket.id,
                  toClientId: peer.clientId,
                  sdp: sdp,
                };
                console.log(`offer to : ${peer.clientId}`);
                socket.emit("offer", offerdto);
              })
              .catch((error) => {
                console.error(`createOffer fail : ${error.toString()}`);
              });

            peer.addEventListener("icecandidate", (event) => {
              const iceCandidate = event.candidate;
              if (iceCandidate) {
                const iceDto: IceDto = {
                  toClientId: peer.clientId,
                  fromClientId: socket.id,
                  ice: iceCandidate,
                };
                console.log(`send ice to : ${peer.clientId}`);
                socket.emit("ice", iceDto);
              }
            });

            peer.addEventListener("track", (event) => {
              console.log(`addTack Called : ${peer.clientId}`);
              peer.remoteStream = event.streams[0];
            });

            peer.addEventListener("connectionstatechange", (event) => {
              const targetPeer = event.target as Peer;
              console.log(targetPeer.connectionState);
            });
          });
        });
      })
      .catch((error) => {
        console.error(`Cannot find user media ${error.toString()}`);
      });
  }, []);

  return (
    <>
      {peers.forEach((peer, key) => {
        return <Video key={key} stream={peer.remoteStream}></Video>;
      })}
    </>
  );
}

export default App;
