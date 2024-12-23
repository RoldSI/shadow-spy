import Peer, { DataConnection } from 'peerjs';
import { gameStateMachine, globalState, sceneMap } from '../app';
import { GamePlay } from '../gameplay';
import Player from '../objects/player/player';

function getRandomFourDigitInt(): number {
    return Math.floor(1000 + Math.random() * 9000);
}

export class Connectivity {
    public peer: Peer;
    public seed: number;
    private connection?: DataConnection;
    private playerId?: string;
    private uniqueness: string = 'o49t8xmus4og89umseo49gmswxyo49x8';

    constructor() {
        this.seed = getRandomFourDigitInt();
        const id = this.seed.toString();
        const formattedId = `${id}-${this.uniqueness}`;
        this.peer = new Peer(formattedId, {
            host: '0.peerjs.com', // Use 'peerjs.com' for PeerJS cloud server
            port: 443,        // Change to 443 for cloud server
            path: '/',
        });

        // Log the generated ID
        this.peer.on('open', (id) => {
            this.playerId = id;
            console.log(`Your Player ID (generated by PeerJS): ${id}`);
            console.log(`Corresponding Seed for randomization: ${this.seed}`);
        });

        // Listen for incoming connections
        this.peer.on('connection', (conn) => {
            this.connection = conn;
            console.log('Connection established as Player B');
            this.setupConnectionHandlers();
        });

        // Listen for errors
        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    // Method to access the player ID
    getPlayerId(): string | undefined {
        return this.playerId!.substring(0, 4);
    }

    connectToPlayer(remotePlayerId: string): void {
        const formattedId = `${remotePlayerId}-${this.uniqueness}`;
        this.seed = +remotePlayerId;
        this.connection = this.peer.connect(formattedId);
        console.log('Connection initiated as Player A');
        this.setupConnectionHandlers();
    }

    private setupConnectionHandlers(): void {
        if (!this.connection) return;

        // Listen for data
        this.connection.on('data', (data: any) => {
            //console.log('Received:', data);
            switch (data.type) {
                case 'init':
                    const {playerA, playerB, scene} = data.content;
                    globalState.scene = sceneMap.get(scene.type)!.fromJSON(scene.content);
                    globalState.gamePlay = new GamePlay(globalState.scene, Player.fromJSON(playerB, true), Player.fromJSON(playerA, false));
                    break;
                case 'start':
                    globalState.startOther = true;
                    break;
                case 'player':
                    if (globalState.gamePlay) {
                        globalState.gamePlay.player_other.updateFromJSON(data.content);
                    }
                    break;

                case 'end':
                    globalState.gamePlay!.player_other.updateFromJSON(data.content);
                    globalState.endOther = true;
                    break;
                default:
                    console.error('Unknown data type:', data.type);
            }
            gameStateMachine.update();
        });

        this.connection.on('open', () => {
            //console.log('Data channel open!');
            gameStateMachine.update();
        });

        this.connection.on('close', () => {
            //console.log('Connection closed.');
        });
    }

    sendData(data: any): void {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        } else {
            console.warn('Connection is not open. Cannot send data.');
        }
    }
}