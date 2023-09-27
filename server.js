const http = require('http');
const fs = require('fs');
const url = require('url')

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if(req.method === 'GET' && req.url === '/'){
      let htmlContent = fs.readFileSync('new-player.html', 'utf-8');
      let modifiedHtmlContent = htmlContent.replace('/#{availableRooms}/g',world.availableRoomsToString());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(modifiedHtmlContent);
    }else{
       res.statusCode = 404;
      res.end('Page not found');
    }

    // Phase 2: POST /player
    if(req.method === 'POST' && req.url === '/player'){
      let {roomID,playerName} = req.body;
      player = new Player (playerName, world.rooms[roomID]);
      res.statusCode = 302;
      res.setHeader('Location',`/rooms/${roomID}`);
      return res.end();
    }else{
      res.statusCode = 404;
      res.end('Room not found');
    }

    // Phase 3: GET /rooms/:roomId
    function redirectToHomePage (){
      let {roomID,playerName} = req.body;
      player = new Player(playerName, world.rooms[roomID]);
      if(!player){
        res.statusCode = 302;
        res.setHeader('Location' , '/');
        return res.end();
      }
    }
    if(req.method === 'GET' && req.url === '/rooms/:roomId'){
      redirectToHomePage();
      let currentRoomID = url.parse(req.url).split('/').pop(); 
      let htmlContent = fs.readFileSync('room.html', 'utf-8');
      let modifiedHtmlContent = htmlContent
      .replace('{{roomName}}', player.currentRoom.currentRoomID.name)
      .replace('{{roomID}}', currentRoomID)
      .replace('{{roomItems}}', player.currentRoom[currentRoomID].items)
      .replace('{{inventory}}', player.items)
      .replace('{{exits}}', player.currentRoom[currentRoomID].exits);

      res.statusCode =200;
      res.setHeader('Content-Type', 'text/html');
      res.end(modifiedHtmlContent);
    }else if(currentRoomID !== player.currentRoom.id){
      res.statusCode = 302;
      res.setHeader('Location', '/rooms/${player.currentRoom.id}')
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if(req.method === 'GET' && req.url === '/rooms/:roomId/:direction'){
      try {
        // Redirect to home page if there is no player
        redirectToHomePage(req, res, player);
    
        // Obtain the current room ID and direction from the URL
        const { roomId, direction } = req.params;
    
        // Ensure the room ID matches the player's current room
        if (roomId !== player.currentRoom.id) {
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
          return res.end();
        }
    
        // Use a method from the Player class to move the player
        const moveResult = player.move(direction);
    
        // Check if the move was successful (you should define this logic in your Player class)
        if (moveResult.success) {
          // Redirect the player to the next room
          res.statusCode = 302;
          res.setHeader('Location', `/rooms/${moveResult.nextRoomId}`);
          return res.end();
        } else {
          // Handle the case where the move was unsuccessful (e.g., invalid direction)
          res.statusCode = 400;
          res.end('Invalid direction or room not found.');
        }
      } catch (err) {
        console.error(err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if(req.method === 'GET' && req.url === '/items/:itemId/:action'){
      try {
        // Redirect to home page if there is no player
        redirectToHomePage(req, res, player);
    
        // Obtain the current itemId and player action from the URL
        const { itemId, action } = req.params;
    
        // Ensure the item exists in the player's inventory
        const item = player.findItemById(itemId);
    
        if (!item) {
          res.statusCode = 404;
          res.end('Item not found in inventory.');
          return;
        }
    
        // Perform the specified action on the item based on the action route parameter
        switch (action) {
          case 'drop':
            player.dropItem(item);
            break;
          case 'eat':
            player.eatItem(item);
            break;
          case 'take':
            player.takeItem(item);
            break;
          default:
            res.statusCode = 400;
            res.end('Invalid action.');
            return;
        }
    
        // Redirect the player to the next room
        res.statusCode = 302;
        res.setHeader('Location', `/rooms/${player.currentRoom.id}`);
        res.end();
      } catch (err) {
        console.error(err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }

    // Phase 6: Redirect if no matching route handlers
    try {
      // Redirect to the player's current room
      redirectToHomePage(req, res, player);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));