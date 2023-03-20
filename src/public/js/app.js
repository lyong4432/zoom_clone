const socket = io();

// call (camera, audio) 
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

let myStream;
let muted = false;
let cameraOff = false;

const welcome = document.getElementById("welcome");
const call = document.getElementById("call");

const welcomeForm = welcome.querySelector("form");

let roomName;

let mypeerConnection;
let myDataChannel;

async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput" );
        const currentCamera = myStream.getVideoTracks()[0];
        // 카메라 장비 목록 
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);

        });
    }catch(e){
        console.log(e);
    }
}

async function getMedia(deviceId){
    const initialConstraints = { // deviceId가 없을 때 실행
        audio: true, 
        video: {facingMode: "user"},
    };
    const cameraConstraints = {
        auio: true,
        video: {deviceId: {exact: deviceId}},
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if (!deviceId){
            await getCameras();
        }
    }
    catch (e) {
        console.log(e);
    }
} 

//getMedia();

function handleMuteClick(){
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if(!muted){
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick(){
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if(mypeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = mypeerConnection.getSenders().find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack();
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input",handleCameraChange);

// Welcome Form (choose room)

call.hidden = true;

async function initCall() {
    welcome.hidden = true;
    call.hidden= false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value="";
}



welcomeForm.addEventListener("submit", handleWelcomeSubmit);


// socket code

//peer A에서 실행 
socket.on("welcome", async() => {
    myDataChannel = mypeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message",(event) => console.log(event.data) );
    const offer = await mypeerConnection.createOffer();
    mypeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
});

//Peer B에서 실행
socket.on("offer", async(offer)=> {
    mypeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", (event) => console.log(event.data));
    });
    console.log("received the offer");
    mypeerConnection.setRemoteDescription(offer);
    const answer = await mypeerConnection.createAnswer();
    mypeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", (answer) => {
    console.log("received the answer");
    mypeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice)=>{
    console.log("received candidate");
    mypeerConnection.addIceCandidate(ice);
});

// RTC code

function makeConnection(){
    mypeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    mypeerConnection.addEventListener("icecandidate", handleIce);
    mypeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach((track) => mypeerConnection.addTrack(track, myStream));
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data){
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
    
}