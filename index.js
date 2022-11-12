import express from "express"
import cors from "cors"
import {MongoClient} from "mongodb"
import { messageSchema, userSchema } from "./schemas.js"
import dayjs from "dayjs"
import { networkInterfaces } from "os"
import path from "path"

const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

await mongoClient.connect()
db = mongoClient.db("batepapouol")

app.post("/participants", async (req, res) => {
    const validation = userSchema.validate(req.body, {abortEarly: false})
    if(validation.error) {
        res.status(422).send(validation.error.details.map(detail => detail.message))
        return
    }
    
    const exist = await db.collection("users").findOne(req.body)
    if(exist) {
        res.status(409).send("User already exist")
        return
    }
    db.collection("users").insertOne({...req.body, "lastStatus": Date.now()})
    db.collection("messages").insertOne({
        "from": req.body.name,
        "to": "Todos",
        "text": "entra na sala...",
        "type": "status",
        "time": dayjs().format("HH:MM:ss")
    })

    res.status(201).send("OK");
})

app.get("/participants", async (req, res) => {
    const users = await db.collection("users").find({}).toArray();
    const sentableUsers = users.map(value => {return {"name": value.name}})
    res.send(sentableUsers)
})

app.post("/messages", async (req, res) => {
    
    const validation = messageSchema.validate(req.body)
    if(validation.error) {
        res.status(422).send(validation.error.details.map(detail => detail.message))
        return;
    }
    
    const participantExist = await db.collection("users").findOne({name: req.headers.user})
    if(!participantExist) {
        res.status(422).send("'from' user does not exist");
        return;
    }

    db.collection("messages").insertOne({
        ...req.body,
        "from": req.headers.user,
        "time": dayjs().format("HH:MM:ss")
    })

    res.status(201).send("OK")

})

app.get("/messages", async (req, res) => {
    
    const messages = await db.collection("messages").find({}).toArray()
    let limit = (req.params.limit ? req.params.limit : Infinity);
    const user = req.headers.user;
    
    const send_messages = []
    for(let i = messages.length-1; i >= 0 && limit; i--) 
        if(messages[i].to == "Todos" || messages[i].to == user || messages[i].from == user) {
            const {_id, ...messageObject} = messages[i]
            send_messages.push(messageObject)
            limit--;
        }
    res.status(200).send(send_messages.reverse())

})

app.post("/status", async (req, res) => {
    const user = req.headers.user
    const userData = await db.collection("users").findOne({"name": user})
    if(!userData) {
        res.status(404).send()
        return
    }
    await db.collection("users").updateOne({_id: userData._id}, 
                                {$set: {...userData, lastStatus: Date.now()}} )
    res.status(200).send(userData)
})

async function clearRegister() {
    const participants = await db.collection("users").find({}).toArray();
    participants.map(element => {
        if(dayjs().unix() - dayjs(element.lastStatus).unix() > 10) {
            db.collection("users").deleteOne({_id: element._id})
            db.collection("messages").insertOne({
                "from": element.name,
                "to": "Todos",
                "text": "sai da sala...",
                "type": "status",
                "time": dayjs().format("HH:MM:ss")
            })
        }
    })
}

setInterval(clearRegister, 15000)
app.listen(5000)