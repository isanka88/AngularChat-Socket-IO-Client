import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as io from 'socket.io-client';
import { MessageVM, ChatUserVM } from '../models';

export class SocketService {
    //   private host: string = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port;
    private socketUrl: string = 'http://localhost:3000';
    socket: SocketIOClient.Socket;

    constructor() {    
        // socket connect options
        // let socketUrl = this.host + '/' + this.name;
        // this.socket = io.connect('http://localhost:3000');
        // var socket = io.connect('http://ip:port');
        // this.socket = io.connect();
        this.socket = io.connect(this.socketUrl);
    }

    // Create new User
    createNewUser(loggedUser: ChatUserVM): Observable<any> {
        return new Observable(observer => {  
         this.socket.emit('new user', loggedUser, () => observer.complete());
        });
    }

    // Get online users observable
    getOnlineUserList(): Observable<any> {
        return Observable.create(observer => {
            this.socket.on('online users', (item: ChatUserVM[]) => observer.next(item));
        });
    }

    // Recieving Private Messages
    recievedMessagePrivate(): Observable<MessageVM> {
        return Observable.create(observer => {
            this.socket.on('new private message', (item: MessageVM) => observer.next(item));
        });
    }

    // Recieving Public Messages
    recievedMessagePublic(): Observable<MessageVM> {
        return Observable.create(observer => {
            this.socket.on('new public message', (item: MessageVM) => observer.next(item));
        });
    }

    // Send private message
    sendMessagePrivate(message: MessageVM): Observable<any> {
        return new Observable(observer => {
            this.socket.emit('send message private', message,(item: any) =>  observer.next(item));
        });
    }

     // socket server will send same message again withour any historay record
     sendMessagePrivateRemind(message: MessageVM): Observable<any> {
        return new Observable(observer => {
            this.socket.emit('send message private remind', message,(item: any) =>  observer.next(item));
        });
    }

    // Send private message
    sendMessagePublic(message: MessageVM): Observable<any> {
        return new Observable(observer => {
            this.socket.emit('send message public', message,(item: any) =>  observer.next(item));
        });
    }


     // Inform when user disconnected
     onTyping(): Observable<any> {     
        return Observable.create(observer => {
            this.socket.on('typing private', (item: any) =>  observer.next(item));
        });
    }

    onTypingSubmit(data:any): Observable<any> {           
        return new Observable(observer => {
            this.socket.emit('typing private',data,() => observer.complete());
        });
    }

     // Inform when user disconnected
     onDisconnect(): Observable<any> {     
        return Observable.create(observer => {
            this.socket.on('disconnect user', (userId: MessageVM) => observer.next(userId));
        });
    }
    
}
