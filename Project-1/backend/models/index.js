const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

// USER
const userSchema = new Schema({
  FirstName: { type: String, required: true },
  LastName: { type: String, required: true },
  Email: { type: String, required: true, unique: true },
  DOB: { type: Date },
  Gender: { type: String },
  Password: { type: String, required: true }, // Added for authentication
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('Password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.Password = await bcrypt.hash(this.Password, salt);
});
const User = mongoose.model('User', userSchema);

// USER_PHONE
const userPhoneSchema = new Schema({
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  PhoneNumber: { type: String, required: true }
});
const UserPhone = mongoose.model('UserPhone', userPhoneSchema);

// ATHLETE
const athleteSchema = new Schema({
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  SportType: { type: String },
  SkillLevel: { type: String }
});
const Athlete = mongoose.model('Athlete', athleteSchema);

// TRAINER
const trainerSchema = new Schema({
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  CertificationNo: { type: String },
  YearsExperience: { type: Number }
});
const Trainer = mongoose.model('Trainer', trainerSchema);

// SUPERVISION
const supervisionSchema = new Schema({
  TrainerID: { type: Schema.Types.ObjectId, ref: 'Trainer', required: true },
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ActivityID: { type: Schema.Types.ObjectId, ref: 'Activity' },
  SessionNotes: { type: String },
  PerformanceRating: { type: Number }
});
const Supervision = mongoose.model('Supervision', supervisionSchema);

// NOTIFICATION_RECIPIENT
const notificationRecipientSchema = new Schema({
  SourceType: { type: String },
  UserID: { type: Schema.Types.ObjectId, ref: 'User' },
  TrainerUserID: { type: Schema.Types.ObjectId, ref: 'Trainer' },
  ContactChannel: { type: String },
  NotificationPref: { type: String }
});
const NotificationRecipient = mongoose.model('NotificationRecipient', notificationRecipientSchema);

// ACTIVITY
const activitySchema = new Schema({
  Type: { type: String, required: true },
  Duration: { type: Number, required: true }, // e.g. minutes
  Distance: { type: Number }, // e.g. kilometers/miles
  Date: { type: Date, default: Date.now },
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});
const Activity = mongoose.model('Activity', activitySchema);

// ACHIEVEMENT
const achievementSchema = new Schema({
  Title: { type: String, required: true },
  Description: { type: String },
  DateAwarded: { type: Date, default: Date.now }
});
const Achievement = mongoose.model('Achievement', achievementSchema);

// EARNS
const earnsSchema = new Schema({
  ActivityID: { type: Schema.Types.ObjectId, ref: 'Activity', required: true },
  AchievementID: { type: Schema.Types.ObjectId, ref: 'Achievement', required: true }
});
const Earns = mongoose.model('Earns', earnsSchema);

// NUTRITION
const nutritionSchema = new Schema({
  MealType: { type: String },
  Calories: { type: Number, required: true },
  Quantity: { type: Number },
  Date: { type: Date, default: Date.now },
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});
const Nutrition = mongoose.model('Nutrition', nutritionSchema);

// NUTRITION_FOODITEM
const nutritionFoodItemSchema = new Schema({
  NutritionID: { type: Schema.Types.ObjectId, ref: 'Nutrition', required: true },
  FoodItem: { type: String, required: true }
});
const NutritionFoodItem = mongoose.model('NutritionFoodItem', nutritionFoodItemSchema);

// WEARABLE_DEVICE
const wearableDeviceSchema = new Schema({
  Brand: { type: String },
  Model: { type: String },
  SerialNumber: { type: String },
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});
const WearableDevice = mongoose.model('WearableDevice', wearableDeviceSchema);

// SMARTWATCH
const smartwatchSchema = new Schema({
  DeviceID: { type: Schema.Types.ObjectId, ref: 'WearableDevice', required: true, unique: true },
  HasGPS: { type: Boolean },
  WaterResistance: { type: String }
});
const Smartwatch = mongoose.model('Smartwatch', smartwatchSchema);

// FITNESS_BAND
const fitnessBandSchema = new Schema({
  DeviceID: { type: Schema.Types.ObjectId, ref: 'WearableDevice', required: true, unique: true },
  BandMaterial: { type: String },
  HasHRSensor: { type: Boolean }
});
const FitnessBand = mongoose.model('FitnessBand', fitnessBandSchema);

// DEVICE_FEATURE
const deviceFeatureSchema = new Schema({
  DeviceID: { type: Schema.Types.ObjectId, ref: 'WearableDevice', required: true },
  FeatureName: { type: String, required: true }
});
const DeviceFeature = mongoose.model('DeviceFeature', deviceFeatureSchema);

// HEALTH_METRIC
const healthMetricSchema = new Schema({
  DeviceID: { type: Schema.Types.ObjectId, ref: 'WearableDevice', required: true },
  MetricType: { type: String, required: true },
  Value: { type: Number, required: true },
  Unit: { type: String },
  Timestamp: { type: Date, default: Date.now }
});
const HealthMetric = mongoose.model('HealthMetric', healthMetricSchema);

// GOAL
const goalSchema = new Schema({
  GoalType: { type: String, required: true },
  TargetValue: { type: Number, required: true },
  Deadline: { type: Date },
  UserID: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});
const Goal = mongoose.model('Goal', goalSchema);

// USER_FOLLOWS
const userFollowsSchema = new Schema({
  FollowerID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  FolloweeID: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});
const UserFollows = mongoose.model('UserFollows', userFollowsSchema);

module.exports = {
  User, UserPhone, Athlete, Trainer, Supervision, NotificationRecipient,
  Activity, Achievement, Earns, Nutrition, NutritionFoodItem,
  WearableDevice, Smartwatch, FitnessBand, DeviceFeature, HealthMetric,
  Goal, UserFollows
};
