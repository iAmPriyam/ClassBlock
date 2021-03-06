const express = require('express')
const bcrypt = require('bcryptjs')
const randomString = require('crypto-random-string')
const jwt = require('jsonwebtoken')
const { secret } = require('../config/keys')
const User = require('../models/User')
const router = express.Router()
const passport = require('passport')
const mongoose = require('mongoose')
const { response } = require('express')

//Routes
/**
 * @swagger
 * /api/user/test:
 *  get:
 *    description: Returns status of the REST routes
 *    responses:
 *      '200':
 *       description : Route works
 */
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Route works' }).status(200)
})
router.get('/profile/:id', (req, res, next) => {
  User.findById(req.params.id)
    .then((user) => {
      if (user) {
        return res.json(user).status(200)
      }
      return res.json({ error: 'user not found' }).status(404)
    })
    .catch((error) => {
      return res.json(error).status(400)
    })
})

router.post('/register', (req, res, next) => {
  User.findOne({
    $or: [{ email: req.body.email }, { uid: req.body.uid }]
  }).then((user) => {
    if (user)
      res
        .json({
          msg:
            req.body.role === 'student'
              ? 'Student with email or enrollment already exists'
              : 'Teacher with email or employee ID already exists'
        })
        .status(400)

    console.log('body', req.body)
    const newUser = new User({
      name: req.body.name,
      uid: req.body.uid,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      username: randomString({ length: 6 })
    })
    bcrypt.genSalt(10, (error, salt) => {
      if (error) throw error
      bcrypt.hash(newUser.password, salt, (error, hash) => {
        if (error) throw error
        newUser.password = hash
        newUser
          .save()
          .then((result) => {
            res.json(result).status(200)
          })
          .catch((error) => {
            if (error) throw error
          })
      })
    })
  })
})

router.post('/login', (req, res) => {
  console.log(req.body)
  const uid = req.body.uid
  const password = req.body.password
  User.findOne({ uid: uid }).then((user) => {
    console.log('user found')
    if (!user) res.status(400).json({ error: 'Invalid credentials' })
    bcrypt.compare(password, user.password).then((isMatch) => {
      console.log('password is matching', isMatch)
      if (isMatch) {
        const payload = {
          id: user._id,
          uid: user.uid,
          name: user.name,
          type: user.role,
          username: user.username
        }
        jwt.sign(payload, secret, { expiresIn: 36000 }, (error, token) => {
          if (error) res.status(401).json({ error })
          res.json({ success: true, token: `Bearer ${token}` })
        })
      } else res.status(400).json({ msg: 'Password does not match' })
    })
  })
})

router.put(
  '/profile-image',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    User.findByIdAndUpdate(req.user.id, { image: req.body.image })
      .then((response) => {
        if (response) {
          res
            .status(200)
            .json({ success: true, message: 'Profile image updated' })
        } else {
          res.status(400).json({ error: 'Could not update image' })
        }
      })
      .catch((error) => res.status(404).json(error))
  }
)

//student follow student
router.put(
  '/follow',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    User.findByIdAndUpdate(
      req.body.userID,
      {
        $push: { follower: req.user.id }
      },
      {
        new: true
      }
    ).exec((err, result) => {
      if (err) {
        return res.status(422).json({ error: err })
      }
    })
    User.findByIdAndUpdate(
      req.user.id,
      {
        $push: { following: req.body.userID }
      },
      {
        new: true
      }
    ).exec((err, result) => {
      if (err) {
        return res.status(422).json({ error: err })
      }
    })
    res
      .json({
        success: true,
        message: `User ${req.user.id} follows ${req.body.userID}`
      })
      .status(200)
  }
)

router.put(
  '/unfollow',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    User.findByIdAndUpdate(
      req.body.userID,
      {
        $pull: { follower: req.user.id }
      },
      {
        new: true
      }
    ).exec((err, result) => {
      if (err) {
        return res.status(422).json({ error: err })
      }
    })
    User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: { following: req.body.userID }
      },
      {
        new: true
      }
    ).exec((err, result) => {
      if (err) {
        return res.status(422).json({ error: err })
      }
    })
    res
      .json({
        success: true,
        message: `User ${req.user.id} unfollows ${req.body.userID}`
      })
      .status(200)
  }
)

router.get(
  '/current',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json(req.user)
  }
)

router.get(
  '/user-profile',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    User.findById(req.user.id)
      .then((response) => {
        if (response) {
          res.status(200).json({ success: true, payload: response })
        } else {
          res
            .status(404)
            .json({ success: false, error: 'Could not find the user' })
        }
      })
      .catch((error) => res.status(400).json(error))
  }
)
//TODO
// update username
// make CR
// test follow/unfollow

module.exports = router
