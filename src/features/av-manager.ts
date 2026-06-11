import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { SocketClient } from '../socket/client';
import { logger } from '../utils/logger';

export class AVManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isCallActive = false;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.onEvent('INCOMING_AV_CALL' as any, (data: any) => {
      logger.info('Incoming AV call', { userId: data.userId });
      this.socket.emitEvent('av-call-incoming' as any, data);
    });

    this.socket.onEvent('AV_CALL_ANSWERED' as any, (data: any) => {
      this.handleAnswer(data.answer);
    });

    this.socket.onEvent('ICE_CANDIDATE' as any, (data: any) => {
      this.addICECandidate(data.candidate);
    });
  }

  async initiateCall(targetUserId: string): Promise<boolean> {
    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 320 }, height: { ideal: 240 } }
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] }
        ]
      });

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.socket.emitEvent('av-remote-stream' as any, { stream: this.remoteStream });
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emitEvent('ICE_CANDIDATE', {
            roomName: this.store.getCurrentRoom(),
            targetUserId,
            candidate: event.candidate.candidate
          });
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emitEvent('AV_CALL_OFFER', {
        roomName: this.store.getCurrentRoom(),
        targetUserId,
        offer: offer.sdp
      });

      this.isCallActive = true;
      logger.info('Call initiated', { targetUserId });
      return true;
    } catch (error) {
      logger.error('Failed to initiate call:', error);
      return false;
    }
  }

  async handleOffer(offer: string, offeringUserId: string): Promise<boolean> {
    try {
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
        });
      }

      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 320 }, height: { ideal: 240 } }
        });

        this.localStream.getTracks().forEach(track => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: offer })
      );

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emitEvent('AV_CALL_ANSWER', {
        roomName: this.store.getCurrentRoom(),
        targetUserId: offeringUserId,
        answer: answer.sdp
      });

      this.isCallActive = true;
      return true;
    } catch (error) {
      logger.error('Failed to handle offer:', error);
      return false;
    }
  }

  private async handleAnswer(answerSdp: string): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      );
    } catch (error) {
      logger.error('Failed to handle answer:', error);
    }
  }

  private async addICECandidate(candidateStr: string): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(
        new RTCIceCandidate({ candidate: candidateStr })
      );
    } catch (error) {
      logger.error('Failed to add ICE candidate:', error);
    }
  }

  async endCall(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isCallActive = false;
    this.socket.emitEvent('AV_CALL_ENDED', {
      roomName: this.store.getCurrentRoom()
    });

    logger.info('Call ended');
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  isActive(): boolean {
    return this.isCallActive;
  }

  dispose(): void {
    this.endCall();
  }
}

export const createAVManager = (store: StateStore, socket: SocketClient) => {
  return new AVManager(store, socket);
};
