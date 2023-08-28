const CONFIDENCE_THRESHOLD = 0.6;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;

let capture;
let posenet;
let singlePose, skeleton;
let actor_img, specs, smoke;

function setup() {
    createCanvas(VIDEO_WIDTH, VIDEO_HEIGHT);
    setupCapture();
    setupPoseNet();
    loadAssets();
}

function setupCapture() {
    capture = createCapture(VIDEO);
    capture.size(VIDEO_WIDTH, VIDEO_HEIGHT);
    capture.hide();
}

function setupPoseNet() {
    posenet = ml5.poseNet(capture, modelLoaded);
    posenet.on('pose', receivedPoses);
}

function loadAssets() {
    actor_img = loadImage('images/shahrukh.png');
    specs = loadImage('images/spects.png');
    smoke = loadImage('images/cigar.png');
}

function receivedPoses(poses) {
    console.log(poses);
    if (poses.length > 0) {
        singlePose = poses[0].pose;
        skeleton = poses[0].skeleton;
    }
}

function modelLoaded() {
    console.log('Model has loaded');
}

function calculateAngle(A, B, C) {
    const a = dist(B.x, B.y, C.x, C.y);
    const b = dist(A.x, A.y, C.x, C.y);
    const c = dist(A.x, A.y, B.x, B.y);
    const angleRad = Math.acos((a*a + b*b - c*c) / (2*a*b));
    const angleDeg = angleRad * (180 / Math.PI);
    return angleDeg;
}

function getJointAngles(pose) {
    const keypoints = pose.keypoints;
    return {
        rightElbow: calculateAngle(keypoints[6].position, keypoints[8].position, keypoints[10].position),
        leftElbow: calculateAngle(keypoints[5].position, keypoints[7].position, keypoints[9].position),
        rightShoulder: calculateAngle(keypoints[12].position, keypoints[6].position, keypoints[8].position),
        leftShoulder: calculateAngle(keypoints[11].position, keypoints[5].position, keypoints[7].position),
        rightKnee: calculateAngle(keypoints[12].position, keypoints[14].position, keypoints[16].position),
        leftKnee: calculateAngle(keypoints[11].position, keypoints[13].position, keypoints[15].position)
    };
}





function draw() {
    image(capture, 0, 0);
    
    if (singlePose) {
        drawKeypoints();
        drawSkeleton();

        const angles = getJointAngles(singlePose);

        // Set text properties
        fill(0, 0, 255); // Blue color
        textSize(16);
        stroke(255); // White stroke
        strokeWeight(3); // Adjust the stroke weight as needed

        // Display angles at joint positions
        text(`${angles.rightElbow.toFixed(2)}°`, singlePose.keypoints[8].position.x, singlePose.keypoints[8].position.y);
        text(`${angles.leftElbow.toFixed(2)}°`, singlePose.keypoints[7].position.x, singlePose.keypoints[7].position.y);
        text(`${angles.rightShoulder.toFixed(2)}°`, singlePose.keypoints[6].position.x, singlePose.keypoints[6].position.y);
        text(`${angles.leftShoulder.toFixed(2)}°`, singlePose.keypoints[5].position.x, singlePose.keypoints[5].position.y);
        text(`${angles.rightKnee.toFixed(2)}°`, singlePose.keypoints[14].position.x, singlePose.keypoints[14].position.y);
        text(`${angles.leftKnee.toFixed(2)}°`, singlePose.keypoints[13].position.x, singlePose.keypoints[13].position.y);
    }
}



function drawKeypoints() {
    fill(255, 0, 0);
    const dotSize = 10;  // Adjust this value as needed
    for (let i = 0; i < singlePose.keypoints.length; i++) {
        const keypoint = singlePose.keypoints[i];
        if (keypoint.score > CONFIDENCE_THRESHOLD) {
            ellipse(keypoint.position.x, keypoint.position.y, dotSize);
        }
    }
}


function drawSkeleton() {
    stroke(255, 255, 255);
    strokeWeight(5);
    for (let j = 0; j < skeleton.length; j++) {
        const startPoint = skeleton[j][0];
        const endPoint = skeleton[j][1];
        if (startPoint.score > CONFIDENCE_THRESHOLD && endPoint.score > CONFIDENCE_THRESHOLD) {
            line(startPoint.position.x, startPoint.position.y, endPoint.position.x, endPoint.position.y);
        }
    }
}
