import { Component, OnInit, Input, Output, EventEmitter, ElementRef, ViewChild, Inject } from '@angular/core';
import * as io from 'socket.io-client';
import { ChatUserVM, MessageVM } from '../shared/models';
import { SocketService } from '../shared/service';
// import 'rxjs/Rx' ;
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

// export interface ImageDialogData {
//   _imagedata: string;

// }

@Component({
  selector: 'app-chatbox',
  templateUrl: './chatbox.component.html',
  styleUrls: ['./chatbox.component.css'],

})

export class ChatboxComponent implements OnInit {
  socket;
  // _imagedata: string;
  @Input() chatboxData;
  @Output() childEvent = new EventEmitter();
  @ViewChild('scroll') private scroll: ElementRef;
  @ViewChild('focus') private focus: ElementRef;
  private showChatBox: boolean;
  private unreadCount: number;
  private selectedUser: ChatUserVM = new ChatUserVM();
  loggedUser: ChatUserVM = new ChatUserVM();
  private sendMessage: MessageVM = new MessageVM();
  private messagesQueue: MessageVM[] = [];
  private defaultMessage: MessageVM;
  private isTyping: boolean;
  private uploadedFile: File;

  constructor(private socketService: SocketService, public dialog: MatDialog) { this.socket = io.connect('http://localhost:3000'); }

  ngOnInit() {

    this.selectedUser = this.chatboxData;
    this.showChatBox = true;
    this.unreadCount = 1;

    if (this.selectedUser.defaultMessage != null) {
      this.defaultMessage = new MessageVM();
      this.defaultMessage = this.selectedUser.defaultMessage;
      this.defaultMessage.senderImage = this.selectedUser.image;
      this.defaultMessage.senderName = this.selectedUser.displayName;
      this.defaultMessage.senderDesignation = this.selectedUser.designation;
      this.defaultMessage.isToday = true;
      this.messagesQueue.push(this.defaultMessage);
      this.selectedUser.defaultMessage = null;
      this.defaultMessage = new MessageVM();
    }

    this.initializeChatServer();
    this.ngAfterViewInit();
  }


  initializeChatServer() {

    var self = this;
    this.loggedUser = JSON.parse(sessionStorage.getItem('loggedUser')) as ChatUserVM;

    // Subscribe to room list updates
    this.socketService.recievedMessagePublic().subscribe(
      data => {
        if (data.from == self.loggedUser.userId) {
          data.senderImage = self.loggedUser.image;
          data.senderName = self.loggedUser.displayName;
          data.senderDesignation = self.loggedUser.designation;
        }
        else {
          data.senderImage = self.selectedUser.image;
          data.senderName = self.selectedUser.displayName;
          data.senderDesignation = self.selectedUser.designation;
        }
        data.isToday = true;
        self.messagesQueue.push(data);
      }, error => console.log(error));

    // Subscribe to room list updates
    this.socketService.recievedMessagePrivate().subscribe(
      data => {

        if (data.from == self.selectedUser.userId) {
          data.senderImage = self.selectedUser.image;
          data.senderName = self.selectedUser.displayName;
          data.senderDesignation = self.selectedUser.designation;
          data.isToday = true;
          if (this.showChatBox) {
            data.isRead = true;
          }
          else {
            data.isRead = false;;
          }
          self.messagesQueue.push(data);

          //get unread count if msg box close
          this.unreadCount = this.messagesQueue.filter(x => x.isRead == false).length;
          this.playAudio();
        }

      }, error => console.log(error));


    // Subscribe when user typing private message
    this.socketService.onTyping().subscribe(
      data => {
        if (self.isTyping != data.isTyping && self.selectedUser.userId == data.from) {
          self.isTyping = data.isTyping;
          console.log(self.selectedUser.displayName + ' isTyping=' + data.isTyping);
        }
      }, error => console.log(error));


    // Subscribe when user disconnect
    this.socketService.onDisconnect().subscribe(
      data => {

        //set online status when chat box is opend
        if (self.selectedUser.userId == data) {
          self.selectedUser.status = "offline";
          self.isTyping = false;
          console.log(self.selectedUser.displayName + ' disconnected from the channel');
        }

        //Reconnect again when logged user is disconnect from server
        if (self.loggedUser.userId == data) {
          self.socketService.createNewUser(self.loggedUser).subscribe();
        }

      }, error => console.log(error));



    // Subscribe to room update when user Reconnect
    this.socketService.getOnlineUserList().subscribe(
      data => {
        if (self.selectedUser.status == "offline" && (data as ChatUserVM[]).filter(user => user.userId == self.selectedUser.userId).length > 0) {
          self.selectedUser.status = "online";
        }
      },
      error => console.log(error)
    );


  }

  sendMessageSubmit() {

    this.sendMessage.isRead = false;
    this.sendMessage.created = new Date();
    this.sendMessage.to = this.selectedUser.userId;
    this.sendMessage.from = this.loggedUser.userId;

    this.socketService.sendMessagePrivate(this.sendMessage).subscribe(
      data => {
        console.log('massage sent > ' + data);
      },
      error => console.log(error)
    );

    // push sent message to chat box
    this.sendMessage.senderImage = this.loggedUser.image;
    this.sendMessage.senderName = this.loggedUser.displayName;
    this.sendMessage.senderDesignation = this.loggedUser.designation;
    this.sendMessage.isToday = true;
    this.messagesQueue.push(this.sendMessage);
    this.sendMessage = new MessageVM();
  };

  onFileChanged(event) {


    this.uploadedFile = event.target.files[0];
    var reader = new FileReader();
    reader.readAsDataURL(this.uploadedFile);

    reader.onload = (e) => {
      this.sendMessage.isRead = false;
      this.sendMessage.created = new Date();
      this.sendMessage.to = this.selectedUser.userId;
      this.sendMessage.from = this.loggedUser.userId;
      this.sendMessage.file = reader.result;
      this.sendMessage.fileName = this.uploadedFile.name;
      this.sendMessage.fileType = this.uploadedFile.type;
      this.sendMessage.fileTypeImage = this.getFileTypeImage(this.uploadedFile.type);
      this.socketService.sendMessagePrivate(this.sendMessage).subscribe(
        data => {
          console.log('massage sent > ' + data);
        },
        error => console.log(error)
      );

      // push sent message to chat box
      this.sendMessage.senderImage = this.loggedUser.image;
      this.sendMessage.senderName = this.loggedUser.displayName;
      this.sendMessage.senderDesignation = this.loggedUser.designation;
      this.sendMessage.isToday = true;
      this.messagesQueue.push(this.sendMessage);
      this.sendMessage = new MessageVM();

    }
  }

  getFileTypeImage(fileType): String {

    var imageUrl = "";
    if (fileType == 'application/vnd.ms-excel') {
      imageUrl = "../../assets/images/doc-icons/excel-xls-icon.png";
    }
    if (fileType == 'application/msword' || fileType == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      imageUrl = "../../assets/images/doc-icons/word-doc-icon.png";
    }
    if (fileType == 'application/pdf') {
      imageUrl = "../../assets/images/doc-icons/pdf-icon.png";
    }
    return imageUrl;
  }

  openDialog(imagedata): void {
    const dialogRef = this.dialog.open(ImagePreviewDialog, {
      data: { _imagedata: imagedata }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      // this.animal = result;
    });
  }

  downloadFile(fileData, fileType,filename) {

   var base64string=fileData.split("base64,"); 

    let byteCharacters = atob(base64string[1]);

    let byteNumbers = new Array(byteCharacters.length);
    for (var i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    let byteArray = new Uint8Array(byteNumbers);

    let blob = new Blob([byteArray], { "type": fileType });

    if (navigator.msSaveBlob) {   
      navigator.msSaveBlob(blob, filename);
    } 
    else {
      let link = document.createElement("a");

      link.href = URL.createObjectURL(blob);

      link.setAttribute('visibility', 'hidden');
      link.download = 'picture';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  playAudio() {
    let audio = new Audio();
    audio.src = "../../../assets/audio/chat-sound.mp3";
    audio.load();
    audio.play();
  }
  //------- START - UI Functinalites ---------------------------------------

  // Handle keypress event, for sending chat message
  eventHandler(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.sendMessageSubmit();

      // emit socket server when user while typing 
      this.socketService.onTypingSubmit({ to: this.selectedUser.userId, isTyping: false }).subscribe(
        data => { },
        error => console.log(error));
    }
    else {

      // emit socket server when user while typing 
      this.socketService.onTypingSubmit({ to: this.selectedUser.userId, isTyping: true }).subscribe(
        data => { },
        error => console.log(error),
        () => { });
    }

  }
  // After view initialized, focus on chat message text input
  ngAfterViewInit(): void {
    this.focus.nativeElement.focus();
  }

  //* Scroll to bottom (this is called when new message is received)
  scrollToBottom(): void {
    //  try {
    //   this.scroll.nativeElement.scrollTop = this.scroll.nativeElement.scrollHeight;
    //  } catch (error) {
    //  console.log('ERROR:', error);
    // }
  }
  chatboxCloseChild(selUser) {
    this.childEvent.emit(selUser);
  }

  get stateName() {
    return this.showChatBox ? 'show' : 'hide'
  }

  toggle() {
    this.showChatBox = !this.showChatBox;

    if (this.showChatBox) {
      //when chat box open unread cound need to be reset
      this.unreadCount = 0;
      this.messagesQueue.forEach(element => { element.isRead = true; });
    }
    else {
      this.unreadCount = this.messagesQueue.filter(x => x.isRead == false).length;
    }
  }
  //------- END - UI Functinalites ---------------------------------------

}


// image preview model
@Component({
  selector: 'image-preview-dialog',
  template: '<div > <img  src="{{data._imagedata}}" style=" min-width:100%; min-height:100%; width:100%; height:auto;" ></div>',
})
export class ImagePreviewDialog {

  constructor(public dialogRef: MatDialogRef<ImagePreviewDialog>, @Inject(MAT_DIALOG_DATA) public data) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
}

