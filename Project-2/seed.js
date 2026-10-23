const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { 
  User, Athlete, Activity, Nutrition, Goal, WearableDevice, Smartwatch,
  HealthMetric, Achievement, Earns, UserFollows, NotificationRecipient
} = require('./models');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB. Purging existing data...');

    // Clear existing
    await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({})));

    console.log('Seeding new data...');
    
    // Seed User
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);
    
    const demoUser = await User.create({
      FirstName: 'Jane',
      LastName: 'Doe',
      Email: 'jane@example.com',
      Password: password,
      DOB: new Date('1990-05-15'),
      Gender: 'Female'
    });

    const friendUser = await User.create({
      FirstName: 'John',
      LastName: 'Smith',
      Email: 'john@example.com',
      Password: password,
      DOB: new Date('1988-10-20'),
      Gender: 'Male'
    });

    // Seed Athlete Profile
    await Athlete.create({
      UserID: demoUser._id,
      SportType: 'Running',
      SkillLevel: 'Intermediate'
    });

    // Seed Social
    await UserFollows.create({ FollowerID: friendUser._id, FolloweeID: demoUser._id });
    await UserFollows.create({ FollowerID: demoUser._id, FolloweeID: friendUser._id });

    // Seed Wearable
    const wearable = await WearableDevice.create({
      Brand: 'Garmin',
      Model: 'Forerunner 265',
      SerialNumber: 'SN-123456789',
      UserID: demoUser._id
    });

    await Smartwatch.create({
      DeviceID: wearable._id,
      HasGPS: true,
      WaterResistance: '5 ATM'
    });

    // Seed Health Metrics
    const now = new Date();
    const metrics = [];
    for(let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      metrics.push({ DeviceID: wearable._id, MetricType: 'Heart Rate', Value: 60 + Math.floor(Math.random() * 20), Unit: 'bpm', Timestamp: d });
      metrics.push({ DeviceID: wearable._id, MetricType: 'Sleep Score', Value: 70 + Math.floor(Math.random() * 25), Unit: '/100', Timestamp: d });
      metrics.push({ DeviceID: wearable._id, MetricType: 'Steps', Value: 8000 + Math.floor(Math.random() * 4000), Unit: 'steps', Timestamp: d });
    }
    await HealthMetric.insertMany(metrics);

    // Seed Activities
    const act1 = await Activity.create({ Type: 'Running', Duration: 45, Distance: 8.2, Date: new Date(now.setDate(now.getDate() - 1)), UserID: demoUser._id });
    const act2 = await Activity.create({ Type: 'Cycling', Duration: 90, Distance: 25.5, Date: new Date(now.setDate(now.getDate() - 2)), UserID: demoUser._id });
    const act3 = await Activity.create({ Type: 'Running', Duration: 30, Distance: 5.0, Date: new Date(now.setDate(now.getDate() - 3)), UserID: demoUser._id });

    // Seed Achievements
    const ach1 = await Achievement.create({ Title: 'First 5K', Description: 'Complete your first 5K run' });
    const ach2 = await Achievement.create({ Title: 'Consistency', Description: 'Workout 3 days in a row' });
    
    await Earns.create({ ActivityID: act3._id, AchievementID: ach1._id });

    // Seed Nutrition
    await Nutrition.create({ MealType: 'Breakfast', Calories: 450, Quantity: 1, Date: new Date(), UserID: demoUser._id });
    await Nutrition.create({ MealType: 'Lunch', Calories: 650, Quantity: 1, Date: new Date(), UserID: demoUser._id });
    await Nutrition.create({ MealType: 'Dinner', Calories: 800, Quantity: 1, Date: new Date(), UserID: demoUser._id });

    // Seed Goals
    await Goal.create({ GoalType: 'Distance', TargetValue: 50, Deadline: new Date(new Date().setDate(new Date().getDate() + 30)), UserID: demoUser._id });
    await Goal.create({ GoalType: 'Workouts', TargetValue: 15, Deadline: new Date(new Date().setDate(new Date().getDate() + 30)), UserID: demoUser._id });

    // Seed Notifications
    await NotificationRecipient.create({ SourceType: 'System', UserID: demoUser._id, ContactChannel: 'Email', NotificationPref: 'Daily Summary' });

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
