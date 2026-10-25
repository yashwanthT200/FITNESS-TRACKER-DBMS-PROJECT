const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { 
  User, UserPhone, Athlete, Trainer, Supervision, NotificationRecipient,
  Activity, Achievement, Earns, Nutrition, NutritionFoodItem,
  WearableDevice, Smartwatch, FitnessBand, DeviceFeature, HealthMetric,
  Goal, UserFollows
} = require('../models');

const router = express.Router();

// Middleware to verify JWT
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token is not valid' });
  }
};

// Auth routes
router.post('/register', async (req, res) => {
  try {
    const { FirstName, LastName, Email, Password, DOB, Gender } = req.body;
    let user = await User.findOne({ Email });
    if (user) return res.status(400).json({ error: 'User already exists' });
    
    user = new User({ FirstName, LastName, Email, Password, DOB, Gender });
    await user.save();
    
    const token = jwt.sign({ UserID: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { _id: user._id, FirstName, LastName, Email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { Email, Password } = req.body;
    const user = await User.findOne({ Email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(Password, user.Password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ UserID: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { _id: user._id, FirstName: user.FirstName, LastName: user.LastName, Email: user.Email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Summary (Aggregated endpoint for convenience)
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.UserID;
    
    const [
      user, athlete, phones, activities, nutrition, goals, 
      wearables, healthMetrics, followers, following, notifications, earns
    ] = await Promise.all([
      User.findById(userId).select('-Password'),
      Athlete.findOne({ UserID: userId }),
      UserPhone.find({ UserID: userId }),
      Activity.find({ UserID: userId }).sort({ Date: -1 }),
      Nutrition.find({ UserID: userId }).sort({ Date: -1 }),
      Goal.find({ UserID: userId }),
      WearableDevice.find({ UserID: userId }),
      HealthMetric.find({ DeviceID: { $in: await WearableDevice.find({ UserID: userId }).distinct('_id') } }).sort({ Timestamp: -1 }),
      UserFollows.countDocuments({ FolloweeID: userId }),
      UserFollows.countDocuments({ FollowerID: userId }),
      NotificationRecipient.find({ UserID: userId }),
      Earns.find({ ActivityID: { $in: await Activity.find({ UserID: userId }).distinct('_id') } }).populate('AchievementID')
    ]);

    const smartwatchList = await Smartwatch.find({ DeviceID: { $in: wearables.map(w => w._id) } });
    const fitnessBandList = await FitnessBand.find({ DeviceID: { $in: wearables.map(w => w._id) } });

    res.json({
      user, athlete, phones, activities, nutrition, goals, 
      wearables: wearables.map(w => {
        const sw = smartwatchList.find(s => s.DeviceID.equals(w._id));
        const fb = fitnessBandList.find(f => f.DeviceID.equals(w._id));
        return { ...w.toObject(), type: sw ? 'Smartwatch' : (fb ? 'FitnessBand' : 'Unknown'), details: sw || fb };
      }), 
      healthMetrics, followers, following, notifications, earns
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic entity routes
const setupCrud = (model, routeName, userField = 'UserID') => {
  router.get(`/${routeName}`, auth, async (req, res) => {
    try {
      const data = await model.find({ [userField]: req.user.UserID });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

setupCrud(Activity, 'activities');
setupCrud(Nutrition, 'nutrition');
setupCrud(Goal, 'goals');
setupCrud(WearableDevice, 'devices');

// Achievements & Earns
router.get('/achievements', auth, async (req, res) => {
  try {
    const activities = await Activity.find({ UserID: req.user.UserID }).distinct('_id');
    const earns = await Earns.find({ ActivityID: { $in: activities } }).populate('AchievementID');
    res.json(earns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trainers
router.get('/trainers', auth, async (req, res) => {
  try {
    const trainers = await Trainer.find().populate('UserID', 'FirstName LastName Email');
    res.json(trainers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
