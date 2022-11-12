import joi from "joi"

export const userSchema = joi.object({
    name: joi.string().required()
})

export const messageSchema = joi.object({
    to: joi.string().required().min(1),
    text: joi.string().required().min(1),
    type: joi.string().required().valid("private_message", "message")
})
