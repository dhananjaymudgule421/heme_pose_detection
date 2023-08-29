const MAX_WIDTH = 640;
const MAX_HEIGHT = 480;

let canvasWidth;
let canvasHeight;
let preRecordedVideo;
let posenet;
let poses = [];

function preload() {
    preRecordedVideo = createVideo(['ref_3.mp4'], videoLoadCallback);
}

function videoLoadCallback() {
    // Calculate the aspect ratio of the video
    let videoAspectRatio = preRecordedVideo.width / preRecordedVideo.height;

    // Calculate canvas dimensions based on the video's aspect ratio
    canvasWidth = MAX_WIDTH;
    canvasHeight = canvasWidth / videoAspectRatio;

    // Ensure canvas dimensions don't exceed maximum values
    if (canvasHeight > MAX_HEIGHT) {
        canvasHeight = MAX_HEIGHT;
        canvasWidth = videoAspectRatio * MAX_HEIGHT;
    }

    // Adjust the size of the video element to match the canvas dimensions
    preRecordedVideo.size(canvasWidth, canvasHeight);

    // Setup canvas and rest of the components
    setupCanvas();
}

function setupCanvas() {
    createCanvas(canvasWidth, canvasHeight);
    preRecordedVideo.loop();
    preRecordedVideo.hide();

    posenet = ml5.poseNet(preRecordedVideo, modelLoaded);
    posenet.on('pose', gotPoses);
}

function modelLoaded() {
    console.log('PoseNet Model Loaded');
}

function gotPoses(results) {
    console.log("Received Poses:", results);  // Log the received poses
    poses = results;
}


function drawKeypoints(pose) {
    fill(255, 0, 0);  // Red for keypoints
    for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        ellipse(keypoint.position.x, keypoint.position.y, 10);
    }
}



function drawSkeleton() {
    for (let i = 0; i < poses.length; i++) {
        let pose = poses[i].pose;

        // Check if the skeleton property exists and has data
        if (!pose.skeleton || pose.skeleton.length === 0) {
            continue;
        }

        let skeleton = pose.skeleton;
        for (let j = 0; j < skeleton.length; j++) {
            let partA = skeleton[j][0];
            let partB = skeleton[j][1];
            stroke(255, 0, 0); // Red color for skeleton
            strokeWeight(4);   // Increase the weight of the stroke
            line(partA.position.x, partA.position.y, partB.position.x, partB.position.y);
        }
    }
}



function draw() {
    background(220);  // Set the background color
    image(preRecordedVideo, 0, 0, canvasWidth, canvasHeight);

    // Draw detected poses on the video
    for (let i = 0; i < poses.length; i++) {
        drawKeypoints(poses[i].pose);
        drawSkeleton(poses[i].pose);
    }
}
