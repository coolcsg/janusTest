mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

const LOGGINPAGE = 'https://firwebrtc.firebaseapp.com/log';


let localStream = null;
// let remoteStream = null;
let roomDialog = null;
let roomsRoomIdDoc = null;
let unsubscribe = null;
let uidList = [];
var janusSesseion = null;
const videostyle = 'width : 50%; height : 50%; display:inline-block;';
var opaqueId = 'videoroomtest-' + Janus.randomString(12);
var doSimulcast = getQueryStringValue('simulcast') === 'yes' || getQueryStringValue('simulcast') === 'true';
var doSimulcast2 = getQueryStringValue('simulcast2') === 'yes' || getQueryStringValue('simulcast2') === 'true';
var subscriber_mode = getQueryStringValue('subscriber-mode') === 'yes' || getQueryStringValue('subscriber-mode') === 'true';
var videoroomPluginHandle = null;
var remoteFeed = null;

function getQueryStringValue(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
        results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function init() {
    document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
    document.querySelector('#hangupBtn').addEventListener('click', hangUp);
    document.querySelector('#createBtn').addEventListener('click', createRoom);
    document.querySelector('#joinBtn').addEventListener('click', joinRoom);
    roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

function uidToNumber(uid) {
    let encode = '';
    for (let i = 0; i < uid.length; i++) {
        let x = uid.slice(i, i + 1);
        encode += x.charCodeAt(0);
    }
    return encode;
}

function redirectToLoginPage() {
    console.log('login failed....');
    window.location.href = LOGGINPAGE;
}

async function openUserMedia(e) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // document.querySelector('#localVideo').srcObject = stream;  // janusSesseion 테스트를 위해 잠시 해제
    localStream = stream;

    console.log('Stream:', document.querySelector('#localVideo').srcObject);
    document.querySelector('#cameraBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = false;
    document.querySelector('#createBtn').disabled = false;
    document.querySelector('#hangupBtn').disabled = false;
}

async function createChatScreen(roomId, uid) {
    document.querySelector('#chatscreen').innerHTML = `    
    <div id="contentCover">
        
        <div id="chatWrap">
            <div id="chatHeader">공지사항</div>
            <div id="chatLog">
                <span>채팅내용</span>
                <br>
            </div>
            <form id="chatForm">
                <input type="text" autocomplete="off" size="30" id="message" placeholder="메시지를 입력하세요">
                <button id="chatsend" type="button"> 전송 </button>
            </form>
        </div>
        <div id="roomWrap">
            <div id="roomList">
                <div id="roomHeader">접속한 인원</div>
                <div id="roomSelect">
                    <div class="roomEl active" data-id="1">성국이</div>
                    <div class="roomEl" data-id="2">혜성이</div>
                    <div class="roomEl" data-id="3">은별이</div>
                    <div class="roomEl" data-id="4">아무게</div>
                </div>
            </div>
        </div>
    </div>
    </div>
    `;
    const db = firebase.firestore();
    chatRef = await db.collection('chattings').doc(roomId).collection('messages');
    var button = document.getElementById('chatsend');
    button.addEventListener('click', function (event) {
        let text = document.getElementById('message').value;
        chatRef.doc().set({
            name: uid,
            message: text,
            time: new Date(),
        });
        document.getElementById('message').value = null;
        let chatlog = document.getElementById('chatLog');

        chatRef.orderBy('time', 'asc').onSnapshot((snapshot) => {
            chatlog.innerHTML = null;
            snapshot.forEach((chat) => {
                let data = chat.data();
                if (data.message) {
                    var span = document.createElement('span');
                    if (data.name === uid) {
                        span.style = 'display: inline-block; width: 95%; text-align: right; margin-right : 10px';
                    } else {
                        span.style = 'display: inline-block; width: 95%; text-align: left; margin-left : 20px';
                    }
                    span.appendChild(document.createTextNode(data.message));
                    chatlog.appendChild(span);
                    let br = document.createElement('br');
                    chatlog.appendChild(br);
                }
            });
        });
    });
}

async function createRoom() {
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#joinBtn').disabled = true;

    const uid = await getUid(createRoomAfterUid);
} //-------------------------------------------- creating Room

async function getUid(callback) {
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            callback(user.uid);
            return user.uid;
        } else {
            alert('접속이 되지 않았습니다! ');
            redirectToLoginPage();
        }
    });
}

function getRandomNumber(size) {
    return Math.round(Math.random() * Math.pow(10, size)).toString();
}

async function createRoomAfterUid(uid) {
    console.log('1112');
    console.log(uid);
    if (uid) {
        const db = firebase.firestore();
        roomsCol = await db.collection('rooms');
        const size = 6;
        roomId = getRandomNumber(size);
        console.log('방 아이디는 : ', roomId);
        roomsCol.get().then((snapshot) => {
            snapshot.forEach((doc) => {
                if (doc.id == roomId) {
                    roomId = getRandomNumber(size);
                }
            });
        });
        roomsCol = await db.collection('rooms').doc(roomId);
        document.querySelector('#currentRoom').innerText = `현재 방 아이디는  ${roomId}  입니다`;

        // uidList 초기화
        var unsub = await roomsCol.collection('uid').onSnapshot((snapshot) => {
            // if (snapshot) {
            snapshot.docs.forEach((doc) => {
                console.log('uidList initialize ... ');
                console.log(doc.id);
                roomsCol.collection('uid').doc(doc.id).delete();
            });
            unsub();
            createRoomAfterUidInitialize(uid, roomsCol, roomId);
        });

        // 채팅 메세지 초기화
        unsubscribe = await db
            .collection('chattings')
            .doc(roomId)
            .collection('messages')
            .onSnapshot((snapshot) => {
                snapshot.docs.forEach((doc) => {
                    console.log('chat messages initialize....');
                    chatRef.doc(doc.id).delete();
                });
                unsubscribe();
            });
        createChatScreen(roomId, uid);
        // Listen for remote ICE candidates above
    } else {
        redirectToLoginPage();
    }
}

async function createRoomAfterUidInitialize(uid, roomsCol, roomId) {
    // 0. 초기화 끝난 후 본인 uid 추가
    roomsCol.collection('uid').doc(uid).set({
        enterance_time: new Date(),
        state: 'online',
    });

    var gatewayCallback = {
        server: server,

        iceServers: [            
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ],
        success: function () {
            var callbacks = {
                plugin: 'janus.plugin.videoroom',
                opaqueId: opaqueId,
                success: function (pluginHandle) {
                    videoroomPluginHandle = pluginHandle;
                    Janus.log('Plugin attached! (' + videoroomPluginHandle.getPlugin() + ', id=' + videoroomPluginHandle.getId() + ')');
                    console.log('room id is : ' + roomId);
                    var registermsg = {
                        message: {
                            request: 'create',
                            room: parseInt(roomId),
                            ptype: 'publisher',
                            permenant: false,
                            is_private: false,
                        },
                    };
                    videoroomPluginHandle.send(registermsg);
                    let bitrate = 200 * 300;
                    videoroomPluginHandle.send({ message: { request: 'configure', bitrate: bitrate } });

                    // let idNum = uidToNumber(uid);
                    // console.log('id : ', idNum);
                    var joinmsg = {
                        message: {
                            request: 'join',
                            room: parseInt(roomId),
                            // room: 1234,
                            ptype: 'publisher',
                            display: uid,
                            pin: null,
                            // id: parseInt(idNum),
                        },
                    };
                    videoroomPluginHandle.send(joinmsg);
                },
                error: function (error) {
                    console.log(error);
                },
                consentDialog: function (on) {
                    console.log('Consent dialog should be ' + (on ? 'on' : 'off') + ' now');
                },
                iceState: function (state) {
                    Janus.log('ICE state changed to ' + state);
                },
                mediaState: function (medium, on) {
                    Janus.log('Janus ' + (on ? 'started' : 'stopped') + ' receiving our ' + medium);
                },
                webrtcState: function (on) {
                    Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
                    if (!on) return;
                },
                onmessage: function (msg, jsep) {
                    Janus.debug(' ::: Got a message (publisher) :::', msg);
                    var event = msg['videoroom'];
                    Janus.debug('Event: ' + event);
                    if (event) {
                        if (event === 'joined') {
                            // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                            myid = msg['id'];
                            mypvtid = msg['private_id'];
                            Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);

                            // 누가 조인했으니 비디오 태그 생성하자 ...

                            if (subscriber_mode) {
                                console.log('subscriber_mode' + subscriber_mode);
                            } else {
                                console.log('subscriber_mode' + subscriber_mode);
                                console.log('videoroomPluginHandle', videoroomPluginHandle);
                                publishOwnFeed(true);
                            }

                            // Any new feed to attach to?
                            if (msg['publishers']) {
                                // 이미 방에 publisher 들이 존재하면 실행되는 부분인듯
                                var list = msg['publishers'];
                                Janus.debug('Got a list of available publishers/feeds:', list);
                                for (var f in list) {
                                    var id = list[f]['id'];
                                    var display = list[f]['display'];
                                    var audio = list[f]['audio_codec'];
                                    var video = list[f]['video_codec'];
                                    Janus.log('  >> [' + id + '] ' + display + ' (audio: ' + audio + ', video: ' + video + ')');
                                    newRemoteFeed(id, display, audio, video, roomId); // roomId 필요 ------------------------------------- !!!
                                }
                            }
                        } else if (event === 'destroyed') {
                            // The room has been destroyed
                            console.log('The room has been destroyed!');
                            window.location.reload();
                        } else if (event === 'event') {
                            // Any new feed to attach to?
                            if (msg['publishers']) {
                                var list = msg['publishers'];
                                Janus.debug('Got a list of available publishers/feeds:', list);
                                for (var f in list) {
                                    var id = list[f]['id'];
                                    var display = list[f]['display'];
                                    var audio = list[f]['audio_codec'];
                                    var video = list[f]['video_codec'];
                                    Janus.log('  >> [' + id + '] ' + display + ' (audio: ' + audio + ', video: ' + video + ')');
                                    newRemoteFeed(id, display, audio, video, roomId); // roomId 필요 ---------------------------------------- !!!
                                }
                            } else if (msg['leaving']) {
                                // One of the publishers has gone away?
                                var leaving = msg['leaving'];
                                Janus.log('Publisher left: ' + leaving);
                                var remoteFeed = null;
                                for (var i = 1; i < 6; i++) {
                                    if (feeds[i] && feeds[i].rfid == leaving) {
                                        remoteFeed = feeds[i];
                                        break;
                                    }
                                }
                                if (remoteFeed != null) {
                                    Janus.debug('Feed ' + remoteFeed.rfid + ' (' + remoteFeed.rfdisplay + ') has left the room, detaching');
                                    $('#remote' + remoteFeed.rfindex)
                                        .empty()
                                        .hide();
                                    $('#videoremote' + remoteFeed.rfindex).empty();
                                    feeds[remoteFeed.rfindex] = null;
                                    remoteFeed.detach();
                                }
                            } else if (msg['unpublished']) {
                                // One of the publishers has unpublished?
                                var unpublished = msg['unpublished'];
                                Janus.log('Publisher left: ' + unpublished);
                                if (unpublished === 'ok') {
                                    // videoroomPluginHandle.hangup();
                                    return;
                                }
                                var remoteFeed = null;
                                for (var i = 1; i < 6; i++) {
                                    if (feeds[i] && feeds[i].rfid == unpublished) {
                                        remoteFeed = feeds[i];
                                        break;
                                    }
                                }
                                if (remoteFeed != null) {
                                    Janus.debug('Feed ' + remoteFeed.rfid + ' (' + remoteFeed.rfdisplay + ') has left the room, detaching');
                                    $('#remote' + remoteFeed.rfindex)
                                        .empty()
                                        .hide();
                                    $('#videoremote' + remoteFeed.rfindex).empty();
                                    feeds[remoteFeed.rfindex] = null;
                                    remoteFeed.detach();
                                }
                            } else if (msg['error']) {
                                if (msg['error_code'] === 426) {
                                    // This is a "no such room" error: give a more meaningful description
                                    console.log('This is a "no such room" error: give a more meaningful description');
                                } else {
                                    console.log('no such room else ' + msg['error']);
                                }
                            }
                        }
                    }
                    if (jsep) {
                        Janus.debug('Handling SDP as well...', jsep);
                        // videoroomPluginHandle.handleRemoteJsep({ jsep: jsep });

                        var body = { audio: true, video: true };
                        videoroomPluginHandle.createOffer({
                            success: function (jsep) {
                                videoroomPluginHandle.send({ message: body, jsep: jsep });
                            },
                            error: function (error) {
                                Janus.debug(error);
                            },
                        });

                        var audio = msg['audio_codec'];
                        if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                            toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                        }
                        var video = msg['video_codec'];
                        if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                            toastr.warning("Our video stream has been rejected, viewers won't see us");
                        }
                    }
                },
                onlocalstream: function (stream) {
                    console.log(' ::: Got a local stream :::', stream);
                    mystream = stream;
                    // Janus.attachMediaStream($('#myvideo').get(0), stream); // .get(0) 이 방식으로 array에서 받아오나???
                    Janus.attachMediaStream($('#localVideo').get(0), stream);

                    var videoTracks = stream.getVideoTracks();
                    localVideoTag = document.getElementById('#localVideo');
                    if (localStream != null) {
                        localVideoTag = videoTracks;
                    } else {
                        alert('local Video Tag is not exists');
                    }
                },
                onremotestream: function (stream) {
                    Janus.debug('Remote feed #' + remoteFeed.rfindex + ', stream:', stream);
                    Janus.attachMediaStream($('#remoteVideo').get(0), stream);
                    var videoTracks = stream.getVideoTracks();
                    let vphid = videoroomPluginHandle.getId();
                    VideoTag = document.getElementById(`#${vphid}`); // id를 받아와야 함...
                    if (stream != null) {
                        VideoTag = videoTracks;
                    }
                },
                oncleanup: function () {
                    Janus.log(' ::: Got a cleanup notification: we are unpublished now :::');
                    // mystream = null;
                },
            };
            janusSesseion.attach(callbacks);
        },
        error: function (error) {
            console.log('gatewayCallback : ' + error);
        },
        destroyed: function () {
            window.location.reload();
        },
    }; // gatewayCallback

    var options = {
        debug: 'all',
        callback: function () {
            // var gatewayCallback = gatewayCallback;
            janusSesseion = new Janus(gatewayCallback);
        },
    };
    Janus.init(options);
}

async function joinRoom() {
    const guid = getUid(joinRoomAfterUid);
}

async function joinRoomAfterUid(uid) {
    const db = firebase.firestore();

    if (uid) {
        document.querySelector('#createBtn').disabled = true;
        document.querySelector('#joinBtn').disabled = true;

        document.querySelector('#confirmJoinBtn').addEventListener(
            'click',
            async () => {
                roomId = document.querySelector('#room-id').value;
                document.querySelector('#currentRoom').innerText = `접속하신 방 아이디는 ${roomId}   입니다. `;
                roomsRoomIdDoc = db.collection('rooms').doc(`${roomId}`);
                console.log('Join room: ', roomId);
                const res = await roomsRoomIdDoc.collection('uid').doc(uid).set({
                    enterance_time: new Date(),
                    state: 'online',
                });

                roomsRoomIdDoc.collection('uid').onSnapshot((snapshot) => {
                    snapshot.forEach((doc) => {
                        uidList.push(doc.id);
                        console.log('uidList update : ', uidList);
                    });

                    let uniqueUids = [...new Set(uidList)];
                    uniqueUids.forEach((id) => {
                        if (id !== uid) {
                            console.log('id : ' + id);
                            var refElement = document.getElementById('videos');
                            var newVideo = document.createElement('video');
                            newVideo.id = `${id}`;
                            newVideo.style = videostyle;
                            newVideo.autoplay = true;
                            newVideo.playsinline = true;
                            refElement.appendChild(newVideo);
                            joinRoomById(uid, roomId, id);
                        }
                    });
                });

                await joinRoomById(uid, roomId);
                createChatScreen(roomId, uid);
            },
            { once: true }
        );
        roomDialog.open();
    } else {
        redirectToLoginPage();
    }
}

async function joinRoomById(uid, roomId, id) {
    const roomsRoomIdMyIdCollection = await roomsRoomIdDoc.collection(uid);
    connectPeer(uid, id, roomsRoomIdMyIdCollection, roomId);
}

async function connectPeer(uid, id, roomsRoomIdMyIdCollection, roomId) {
    console.log('connectPeer triggered');
    var gatewayCallback = {
        server: server,
        iceServers: [{ urls: 'turns:turn.112.161.122.2:3478?transport=tcp', username: 'shareemotion', credential: '111211' }],
        success: function () {
            var callbacks = {
                plugin: 'janus.plugin.videoroom',
                opaqueId: opaqueId,
                success: function (pluginHandle) {
                    videoroomPluginHandle = pluginHandle;
                    Janus.log('Plugin attached! (' + videoroomPluginHandle.getPlugin() + ', id=' + videoroomPluginHandle.getId() + ')');

                    // let uidNum = uidToNumber(uid);
                    let msg = {
                        request: 'join',
                        room: parseInt(roomId),
                        // room: 1234,
                        ptype: 'publisher',
                        // ptype: 'subscriber',
                        display: uid,
                        pin: null,
                    };
                    videoroomPluginHandle.send({ message: msg });
                },
                error: function (error) {
                    console.log(error);
                },
                consentDialog: function (on) {},
                iceState: function (state) {
                    Janus.log('ICE state changed to ' + state);
                },
                mediaState: function (medium, on) {
                    Janus.log('Janus ' + (on ? 'started' : 'stopped') + ' receiving our ' + medium);
                },
                webrtcState: function (on) {
                    Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
                    if (!on) return;
                },
                onmessage: function (msg, jsep) {
                    Janus.log(' ::: Got a message (publisher) :::', msg);
                    var event = msg['videoroom'];
                    Janus.log('Event: ' + event);
                    if (event) {
                        if (event === 'joined') {
                            // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                            myid = msg['id'];
                            mypvtid = msg['private_id'];
                            Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);


                            if (subscriber_mode) {
                                console.log('subscriber_mode' + subscriber_mode);
                            } else {
                                console.log('subscriber_mode' + subscriber_mode);
                                console.log('videoroomPluginHandle', videoroomPluginHandle);
                                publishOwnFeed(true);
                            }

                            // Any new feed to attach to?
                            if (msg['publishers']) {
                                // 이미 방에 publisher 들이 존재하면 실행되는 부분인듯
                                var list = msg['publishers'];
                                Janus.debug('onmessage is : ', msg);
                                Janus.debug('Got a list of available publishers/feeds:', list);
                                for (var f in list) {
                                    var id = list[f]['id'];
                                    var display = list[f]['display'];
                                    var audio = list[f]['audio_codec'];
                                    var video = list[f]['video_codec'];
                                    Janus.log('  >> [' + id + '] ' + display + ' (audio: ' + audio + ', video: ' + video + ')');
                                    newRemoteFeed(id, display, audio, video, roomId); // roomId 필요 ------------------------------------- !!!
                                }
                            }
                        } else if (event === 'destroyed') {
                            // The room has been destroyed
                            console.log('The room has been destroyed!');
                            window.location.reload();
                        } else if (event === 'event') {
                            // Any new feed to attach to?
                            if (msg['publishers']) {
                                var list = msg['publishers'];
                                Janus.debug('Got a list of available publishers/feeds:', list);
                                for (var f in list) {
                                    var id = list[f]['id'];
                                    var display = list[f]['display'];
                                    var audio = list[f]['audio_codec'];
                                    var video = list[f]['video_codec'];
                                    Janus.log('  >> [' + id + '] ' + display + ' (audio: ' + audio + ', video: ' + video + ')');
                                    newRemoteFeed(id, display, audio, video, roomId); // roomId 필요 ---------------------------------------- !!!
                                }
                            } else if (msg['leaving']) {
                                // One of the publishers has gone away?
                                var leaving = msg['leaving'];
                                Janus.log('Publisher left: ' + leaving);
                                var remoteFeed = null;
                                for (var i = 1; i < 6; i++) {
                                    if (feeds[i] && feeds[i].rfid == leaving) {
                                        remoteFeed = feeds[i];
                                        break;
                                    }
                                }
                                if (remoteFeed != null) {
                                    Janus.debug('Feed ' + remoteFeed.rfid + ' (' + remoteFeed.rfdisplay + ') has left the room, detaching');
                                    $('#remote' + remoteFeed.rfindex)
                                        .empty()
                                        .hide();
                                    $('#videoremote' + remoteFeed.rfindex).empty();
                                    feeds[remoteFeed.rfindex] = null;
                                    remoteFeed.detach();
                                }
                            } else if (msg['unpublished']) {
                                // One of the publishers has unpublished?
                                var unpublished = msg['unpublished'];
                                Janus.log('Publisher left: ' + unpublished);
                                if (unpublished === 'ok') {
                                    // That's us
                                    videoroomPluginHandle.hangup();
                                    return;
                                }
                                var remoteFeed = null;
                                for (var i = 1; i < 6; i++) {
                                    if (feeds[i] && feeds[i].rfid == unpublished) {
                                        remoteFeed = feeds[i];
                                        break;
                                    }
                                }
                                if (remoteFeed != null) {
                                    Janus.debug('Feed ' + remoteFeed.rfid + ' (' + remoteFeed.rfdisplay + ') has left the room, detaching');
                                    $('#remote' + remoteFeed.rfindex)
                                        .empty()
                                        .hide();
                                    $('#videoremote' + remoteFeed.rfindex).empty();
                                    feeds[remoteFeed.rfindex] = null;
                                    remoteFeed.detach();
                                }
                            } else if (msg['error']) {
                                if (msg['error_code'] === 426) {
                                    // This is a "no such room" error: give a more meaningful description
                                    console.log('This is a "no such room" error: give a more meaningful description');
                                } else {
                                    console.log('no such room else error : ' + msg['error']);
                                }
                            }
                        }
                    }
                    if (jsep) {
                        Janus.debug('Handling SDP as well...', jsep);
                        // videoroomPluginHandle.handleRemoteJsep({ jsep: jsep });

                        videoroomPluginHandle.createAnswer({
                            jsep: jsep,
                            media: { audioSend: true, videoSend: true },
                            success: function (ourjsep) {
                                var body = { request: 'start' };
                                videoroomPluginHandle.send({ message: body, jsep: ourjsep });
                            },
                            error: function (error) {
                                Janus.debug(error);
                            },
                        });

                        var audio = msg['audio_codec'];
                        if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
                            toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                        }
                        var video = msg['video_codec'];
                        if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
                            toastr.warning("Our video stream has been rejected, viewers won't see us");
                        }
                    }
                },
                onlocalstream: function (stream) {
                    Janus.log(' ::: Got a local stream :::', stream);
                    mystream = stream;
                    // Janus.attachMediaStream($('#myvideo').get(0), stream); // .get(0) 이 방식으로 array에서 받아오나???
                    Janus.attachMediaStream($('#localVideo').get(0), stream);

                    var videoTracks = stream.getVideoTracks();
                    localVideoTag = document.getElementById('#localVideo');
                    if (localStream != null) {
                        console.log('connectPeer local video is set');
                        localVideoTag = videoTracks;
                    } else {
                        alert('local Video Tag is not exists');
                    }
                },
                onremotestream: function (stream) {
                    Janus.debug('Remote feed #' + remoteFeed.rfindex + ', stream:', stream);
                    Janus.attachMediaStream($('#remoteVideo').get(0), stream);
                    var videoTracks = stream.getVideoTracks();
                    let vphid = videoroomPluginHandle.getId();
                    console.log('firebase uid : ' + id);
                    VideoTag = document.getElementById(`#${id}`); // id를 받아와야 함...
                    if (stream != null) {
                        VideoTag = videoTracks;
                    }
                },
                oncleanup: function () {
                    Janus.log(' ::: Got a cleanup notification: we are unpublished now :::');
                },
            };
            janusSesseion.attach(callbacks);
        }, // gatewayCallback >> success
        error: function (error) {
            // Janus.error(error);
            console.log('gatewayCallback property error : ' + error);
        },
        destroyed: function () {
            window.location.reload();
        },
    }; // gatewayCallback
    var options = {
        debug: 'all',
        callback: function () {
            janusSesseion = new Janus(gatewayCallback);
        },
    };

    Janus.init(options);
} // connectPeer

async function hangUp(e) {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach((track) => {
        track.stop();
    });

    if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection) {
        peerConnection.close();
    }

    document.querySelector('#localVideo').srcObject = null;
    document.querySelector('#remoteVideo').srcObject = null;
    document.querySelector('#cameraBtn').disabled = false;
    document.querySelector('#joinBtn').disabled = true;
    document.querySelector('#createBtn').disabled = true;
    document.querySelector('#hangupBtn').disabled = true;
    document.querySelector('#currentRoom').innerText = '';

    // Delete room on hangup
    if (roomId) {
        const db = firebase.firestore();
        const roomsRoomIdDoc = db.collection('rooms').doc(roomId);
        const calleeCandidates = await roomsRoomIdDoc.collection().get();
        calleeCandidates.forEach(async (candidate) => {
            await candidate.delete();
        });
        const callerCandidates = await roomsRoomIdDoc.collection('callerCandidates').get();
        callerCandidates.forEach(async (candidate) => {
            await candidate.delete();
        });
        await roomsRoomIdDoc.delete();
    }

    document.location.reload(true);
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
    });

    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

function newRemoteFeed(id, display, audio, video, roomId) {
    console.log(' :: newRemoteFeed triggered :: ');
    console.log(id);
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    janusSesseion.attach({
        plugin: 'janus.plugin.videoroom',
        opaqueId: opaqueId,
        success: function (videoroomPluginHandle) {
            videoroomPluginHandle = videoroomPluginHandle;
            videoroomPluginHandle.simulcastStarted = false;
            Janus.log('Plugin attached! (' + videoroomPluginHandle.getPlugin() + ', id=' + videoroomPluginHandle.getId() + ')');
            Janus.log('  -- This is a subscriber');
            // We wait for the plugin to send us an offer
            var subscribe = {
                request: 'join',
                room: parseInt(roomId),
                ptype: 'subscriber',
                feed: id,
                private_id: mypvtid,
            };
            // In case you don't want to receive audio, video or data, even if the
            // publisher is sending them, set the 'offer_audio', 'offer_video' or
            // 'offer_data' properties to false (they're true by default), e.g.:
            // 		subscribe["offer_video"] = false;
            // For example, if the publisher is VP8 and this is Safari, let's avoid video
            if (Janus.webRTCAdapter.browserDetails.browser === 'safari' && (video === 'vp9' || (video === 'vp8' && !Janus.safariVp8))) {
                if (video) video = video.toUpperCase();
                toastr.warning('Publisher is using ' + video + ", but Safari doesn't support it: disabling video");
                subscribe['offer_video'] = false;
            }
            videoroomPluginHandle.videoCodec = video;
            videoroomPluginHandle.send({ message: subscribe });
        },
        error: function (error) {
            console.log('new videoroomPluginHandle property  : ' + error);
        },
        onmessage: function (msg, jsep) {
            Janus.debug(' ::: Got a message (subscriber) :::', msg);
            var event = msg['videoroom'];
            Janus.debug('Event: ' + event);
            if (msg['error']) {
                console.log('onmesseage error : ' + msg['error']);
            } else if (event) {
                if (event === 'attached') {
                    // Subscriber created and attached
                    for (var i = 1; i < 6; i++) {
                        if (!feeds[i]) {
                            feeds[i] = videoroomPluginHandle;
                            videoroomPluginHandle.rfindex = i;
                            break;
                        }
                    }
                    videoroomPluginHandle.rfid = msg['id'];
                    videoroomPluginHandle.rfdisplay = msg['display'];
                    if (!videoroomPluginHandle.spinner) {
                        var target = document.getElementById('videoremote' + videoroomPluginHandle.rfindex);
                        videoroomPluginHandle.spinner = new Spinner({ top: 100 }).spin(target);
                    } else {
                        videoroomPluginHandle.spinner.spin();
                    }
                    Janus.log(
                        'Successfully attached to feed ' +
                            videoroomPluginHandle.rfid +
                            ' (' +
                            videoroomPluginHandle.rfdisplay +
                            ') in room ' +
                            msg['room']
                    );
                    $('#remote' + videoroomPluginHandle.rfindex)
                        .removeClass('hide')
                        .html(videoroomPluginHandle.rfdisplay)
                        .show();
                } else if (event === 'event') {
                    // Check if we got an event on a simulcast-related event from this publisher
                    var substream = msg['substream'];
                    var temporal = msg['temporal'];
                    if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                        if (!videoroomPluginHandle.simulcastStarted) {
                            videoroomPluginHandle.simulcastStarted = true;
                            // Add some new buttons
                            addSimulcastButtons(
                                videoroomPluginHandle.rfindex,
                                videoroomPluginHandle.videoCodec === 'vp8' || videoroomPluginHandle.videoCodec === 'h264'
                            );
                        }
                        // We just received notice that there's been a switch, update the buttons
                        updateSimulcastButtons(videoroomPluginHandle.rfindex, substream, temporal);
                    }
                } else {
                    // What has just happened?
                }
            }
            if (jsep) {
                Janus.debug('Handling SDP as well...', jsep);
                // Answer and attach
                videoroomPluginHandle.createAnswer({
                    jsep: jsep,
                    media: { audioSend: false, videoSend: false }, // We want recvonly audio/video
                    success: function (jsep) {
                        Janus.debug('Got SDP!', jsep);
                        var body = { request: 'start', room: parseInt(roomId) };
                        videoroomPluginHandle.send({ message: body, jsep: jsep });
                    },
                    error: function (error) {
                        console.log('newRemoteFeed error properties : ' + error);
                    },
                });
            }
        },
        iceState: function (state) {
            Janus.log('ICE state of this WebRTC PeerConnection (feed #' + videoroomPluginHandle.rfindex + ') changed to ' + state);
        },
        webrtcState: function (on) {
            Janus.log(
                'Janus says this WebRTC PeerConnection (feed #' + videoroomPluginHandle.rfindex + ') is ' + (on ? 'up' : 'down') + ' now'
            );
        },
        onlocalstream: function (stream) {
            // The subscriber stream is recvonly, we don't expect anything here
        },
        onremotestream: function (stream) {
            Janus.debug('Remote feed #' + videoroomPluginHandle.rfindex + ', stream:', stream);
            Janus.attachMediaStream($('#remoteVideo').get(0), stream);
            var videoTracks = stream.getVideoTracks();
        },
        oncleanup: function () {
            Janus.log(' ::: Got a cleanup notification (remote feed ' + id + ') :::');
            if (videoroomPluginHandle.spinner) videoroomPluginHandle.spinner.stop();
            videoroomPluginHandle.spinner = null;
            $('#remotevideo' + videoroomPluginHandle.rfindex).remove();
            $('#waitingvideo' + videoroomPluginHandle.rfindex).remove();
            $('#novideo' + videoroomPluginHandle.rfindex).remove();
            $('#curbitrate' + videoroomPluginHandle.rfindex).remove();
            $('#curres' + videoroomPluginHandle.rfindex).remove();
            if (bitrateTimer[videoroomPluginHandle.rfindex]) clearInterval(bitrateTimer[videoroomPluginHandle.rfindex]);
            bitrateTimer[videoroomPluginHandle.rfindex] = null;
            videoroomPluginHandle.simulcastStarted = false;
            $('#simulcast' + videoroomPluginHandle.rfindex).remove();
        },
    });
} // newRemoteFeed
function publishOwnFeed(useAudio) {
    // input으로 넣는 useAudio는 단지 오디오를 쓸건지를 묻는 것임
    // Publish our stream
    console.log('videoroomPluginHandle', videoroomPluginHandle);
    videoroomPluginHandle.createOffer({
        // Add data:true here if you want to publish datachannels as well
        media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true }, // Publishers are sendonly
        simulcast: doSimulcast,
        simulcast2: doSimulcast2,
        success: function (jsep) {
            Janus.debug('Got publisher SDP!', jsep);
            let bitrate = 200 * 300;
            var publish = { request: 'configure', audio: useAudio, video: true, bitrate: bitrate };
            videoroomPluginHandle.send({ message: publish, jsep: jsep });
        },
        error: function (error) {
            console.log('publishOwnFeed');
            Janus.error('WebRTC error:', error);
            if (useAudio) {
                publishOwnFeed(false);
            } else {
                console.log('WebRTC error... ' + error.message);
            }
        },
    });
} //publishOwnFeed
init();
