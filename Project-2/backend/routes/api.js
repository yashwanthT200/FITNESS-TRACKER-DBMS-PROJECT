const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getConnection } = require('../config/database');
const { Point, getWriteApi, flushWrites, deleteData } = require('../config/influx');
const oracledb = require("oracledb");
const router = express.Router();

const auth = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(
      token.split(' ')[1],
      process.env.JWT_SECRET
    );

    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token is not valid' });
  }
};

router.post('/register', async (req, res) => {
  let connection;

  try {
    const {
      FirstName,
      LastName,
      Email,
      Password,
      DOB,
      Gender
    } = req.body;

    connection = await getConnection();

    const existing = await connection.execute(
      `SELECT UserID FROM USERS WHERE Email = :Email`,
      { Email }
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    const result = await connection.execute(
      `INSERT INTO USERS
       (FirstName, LastName, Email, DOB, Gender, Password)
       VALUES
       (:FirstName, :LastName, :Email, :DOB, :Gender, :Password)
       RETURNING UserID INTO :UserID`,
      {
        FirstName,
        LastName,
        Email,
        DOB: DOB ? new Date(DOB) : null,
        Gender,
        Password: hashedPassword,
        UserID: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER }
      },
      { autoCommit: true }
    );

    const userId = result.outBinds.UserID[0];

    const token = jwt.sign(
      { UserID: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        _id: userId,
        FirstName,
        LastName,
        Email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/signup', async (req, res) => {
  let connection;

  try {
    const {
      FirstName,
      LastName,
      Email,
      DOB,
      Gender,
      Password
    } = req.body;

    if (!FirstName || !LastName || !Email || !DOB || !Gender || !Password) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    connection = await getConnection();

    const existingUser = await connection.execute(
      `SELECT UserID
       FROM USERS
       WHERE Email = :Email`,
      { Email }
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    await connection.execute(
      `INSERT INTO USERS
       (FirstName, LastName, Email, DOB, Gender, Password)
       VALUES
       (:FirstName, :LastName, :Email, TO_DATE(:DOB, 'YYYY-MM-DD'), :Gender, :Password)`,
      {
        FirstName,
        LastName,
        Email,
        DOB,
        Gender,
        Password: hashedPassword
      }
    );

    await connection.commit();

    res.status(201).json({
      message: 'Account created successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/login', async (req, res) => {
  let connection;

  try {
    const { Email, Password } = req.body;

    connection = await getConnection();

    const result = await connection.execute(
      `SELECT UserID, FirstName, LastName, Email, Password
       FROM USERS
       WHERE Email = :Email`,
      { Email }
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
      Password,
      user.PASSWORD
    );

    if (!isMatch) {
      return res.status(400).json({
        error: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { UserID: user.USERID },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        _id: user.USERID,
        FirstName: user.FIRSTNAME,
        LastName: user.LASTNAME,
        Email: user.EMAIL
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get('/dashboard', auth, async (req, res) => {
  let connection;

  try {
    const userId = req.user.UserID;

    connection = await getConnection();

    const userResult = await connection.execute(
      `SELECT UserID, FirstName, LastName, Email, DOB, Gender
       FROM USERS
       WHERE UserID = :userId`,
      { userId }
    );

    const athleteResult = await connection.execute(
      `SELECT UserID, SportType, SkillLevel
       FROM ATHLETE
       WHERE UserID = :userId`,
      { userId }
    );

    const phonesResult = await connection.execute(
      `SELECT UserID, PhoneNumber
       FROM USER_PHONE
       WHERE UserID = :userId`,
      { userId }
    );

    const activitiesResult = await connection.execute(
      `SELECT ActivityID, Type, Duration, Distance, "Date", UserID
       FROM ACTIVITY
       WHERE UserID = :userId
       ORDER BY "Date" DESC`,
      { userId }
    );

    const nutritionResult = await connection.execute(
      `SELECT NutritionID, MealType, Calories, Quantity, "Date", UserID
       FROM NUTRITION
       WHERE UserID = :userId
       ORDER BY "Date" DESC`,
      { userId }
    );

    const goalsResult = await connection.execute(
      `SELECT GoalID, GoalType, TargetValue, Deadline, UserID
       FROM GOAL
       WHERE UserID = :userId`,
      { userId }
    );

    const wearablesResult = await connection.execute(
      `SELECT DeviceID, Brand, Model, SerialNumber, UserID
       FROM WEARABLE_DEVICE
       WHERE UserID = :userId`,
      { userId }
    );

    const healthMetricsResult = await connection.execute(
      `SELECT hm.DeviceID,
              hm.MetricID,
              hm.MetricType,
              hm.Value,
              hm.Unit,
              hm.Timestamp
       FROM HEALTH_METRIC hm
       JOIN WEARABLE_DEVICE wd
         ON hm.DeviceID = wd.DeviceID
       WHERE wd.UserID = :userId
       ORDER BY hm.Timestamp DESC`,
      { userId }
    );

    const followersResult = await connection.execute(
      `SELECT COUNT(*) AS COUNT
       FROM USER_FOLLOWS
       WHERE FolloweeID = :userId`,
      { userId }
    );

    const followingResult = await connection.execute(
      `SELECT COUNT(*) AS COUNT
       FROM USER_FOLLOWS
       WHERE FollowerID = :userId`,
      { userId }
    );

    const notificationsResult = await connection.execute(
      `SELECT RecipientID,
              SourceType,
              UserID,
              TrainerUserID,
              ContactChannel,
              NotificationPref
       FROM NOTIFICATION_RECIPIENT
       WHERE UserID = :userId`,
      { userId }
    );

    const earnsResult = await connection.execute(
      `SELECT e.ActivityID,
              e.AchievementID,
              a.Title,
              a.Description,
              a.DateAwarded
       FROM EARNS e
       JOIN ACHIEVEMENT a
         ON e.AchievementID = a.AchievementID
       JOIN ACTIVITY act
         ON e.ActivityID = act.ActivityID
       WHERE act.UserID = :userId`,
      { userId }
    );

    const smartwatchResult = await connection.execute(
      `SELECT s.DeviceID,
              s.HasGPS,
              s.WaterResistance
       FROM SMARTWATCH s
       JOIN WEARABLE_DEVICE w
         ON s.DeviceID = w.DeviceID
       WHERE w.UserID = :userId`,
      { userId }
    );

    const fitnessBandResult = await connection.execute(
      `SELECT f.DeviceID,
              f.BandMaterial,
              f.HasHRSensor
       FROM FITNESS_BAND f
       JOIN WEARABLE_DEVICE w
         ON f.DeviceID = w.DeviceID
       WHERE w.UserID = :userId`,
      { userId }
    );

    const wearables = wearablesResult.rows.map(w => {
      const smartwatch = smartwatchResult.rows.find(
        s => s.DEVICEID === w.DEVICEID
      );

      const fitnessBand = fitnessBandResult.rows.find(
        f => f.DEVICEID === w.DEVICEID
      );

      return {
        DeviceID: w.DEVICEID,
        Brand: w.BRAND,
        Model: w.MODEL,
        SerialNumber: w.SERIALNUMBER,
        UserID: w.USERID,
        type: smartwatch
          ? 'Smartwatch'
          : fitnessBand
            ? 'FitnessBand'
            : 'Unknown',
        details: smartwatch || fitnessBand || null
      };
    });

    res.json({
      user: userResult.rows[0] || null,
      athlete: athleteResult.rows[0] || null,
      phones: phonesResult.rows,
      activities: activitiesResult.rows,
      nutrition: nutritionResult.rows,
      goals: goalsResult.rows,
      wearables,
      healthMetrics: healthMetricsResult.rows,
      followers: followersResult.rows[0].COUNT,
      following: followingResult.rows[0].COUNT,
      notifications: notificationsResult.rows,
      earns: earnsResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/activities', auth, async (req, res) => {
  let connection;

  try {
    console.log("GET /activities - UserID:", req.user.UserID);

    connection = await getConnection();

    const result = await connection.execute(
      `SELECT ActivityID, Type, Duration, Distance, "Date", UserID
       FROM ACTIVITY
       WHERE UserID = :userId
       ORDER BY "Date" DESC`,
      {
        userId: req.user.UserID
      }
    );

    console.log("Activities fetched:", result.rows.length);

    res.json(result.rows);

  } catch (error) {
    console.error("GET /activities ERROR:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/activities', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const { Type, Duration, Distance, Date } = req.body;

    if (!Type || Duration == null || Distance == null || !Date) {
      return res.status(400).json({
        error: "Type, Duration, Distance and Date are required"
      });
    }

    const result = await connection.execute(
      `INSERT INTO ACTIVITY
       (Type, Duration, Distance, "Date", UserID)
       VALUES
       (:activityType, :duration, :distance, TO_DATE(:activityDate, 'YYYY-MM-DD'), :userId)
       RETURNING ActivityID INTO :activityId`,
      {
        activityType: Type,
        duration: Number(Duration),
        distance: Number(Distance),
        activityDate: Date,
        userId: req.user.UserID,
        activityId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      },
      { autoCommit: true }
    );

    res.status(201).json({
      message: "Activity created successfully",
      ActivityID: result.outBinds.activityId[0]
    });

  } catch (error) {
    console.error("Create activity error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.put('/activities/:activityId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const activityId = Number(req.params.activityId);

    const {
      Type,
      Duration,
      Distance,
      Date
    } = req.body;

    if (
      !Type ||
      Duration == null ||
      Distance == null ||
      !Date
    ) {
      return res.status(400).json({
        error: "Type, Duration, Distance and Date are required"
      });
    }

    const result = await connection.execute(
      `UPDATE ACTIVITY
       SET
         Type = :type,
         Duration = :duration,
         Distance = :distance,
         "Date" = TO_DATE(:activityDate, 'YYYY-MM-DD')
       WHERE ActivityID = :activityId
       AND UserID = :userId`,
      {
        type: Type,
        duration: Number(Duration),
        distance: Number(Distance),
        activityDate: Date,
        activityId,
        userId: req.user.UserID
      },
      {
        autoCommit: true
      }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Activity not found or does not belong to you"
      });
    }

    res.json({
      message: "Activity updated successfully"
    });

  } catch (error) {
    console.error("Update activity error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});


router.delete('/activities/:activityId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const activityId = Number(req.params.activityId);

    const result = await connection.execute(
      `DELETE FROM ACTIVITY
       WHERE ActivityID = :activityId
       AND UserID = :userId`,
      {
        activityId,
        userId: req.user.UserID
      },
      {
        autoCommit: true
      }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Activity not found or does not belong to you"
      });
    }

    res.json({
      message: "Activity deleted successfully"
    });

  } catch (error) {
    console.error("Delete activity error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get('/nutrition', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT NutritionID, MealType, Calories, Quantity, "Date", UserID
       FROM NUTRITION
       WHERE UserID = :userId
       ORDER BY "Date" DESC`,
      { userId: req.user.UserID }
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/nutrition', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      MealType,
      Calories,
      Quantity,
      Date,
      FoodItems
    } = req.body;

    if (
      !MealType ||
      Calories == null ||
      Quantity == null ||
      !Date
    ) {
      return res.status(400).json({
        error: "MealType, Calories, Quantity and Date are required"
      });
    }

    const foodItems = Array.isArray(FoodItems)
      ? FoodItems.filter(item => item && item.trim())
      : [];

    const nutritionResult = await connection.execute(
      `INSERT INTO NUTRITION
       (MealType, Calories, Quantity, "Date", UserID)
       VALUES
       (:mealType, :calories, :quantity,
        TO_DATE(:nutritionDate, 'YYYY-MM-DD'), :userId)
       RETURNING NutritionID INTO :nutritionId`,
      {
        mealType: MealType,
        calories: Number(Calories),
        quantity: Number(Quantity),
        nutritionDate: Date,
        userId: req.user.UserID,
        nutritionId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      }
    );

    const nutritionId = nutritionResult.outBinds.nutritionId[0];

    for (const foodItem of foodItems) {
      await connection.execute(
        `INSERT INTO NUTRITION_FOODITEM
         (NutritionID, FoodItem)
         VALUES
         (:nutritionId, :foodItem)`,
        {
          nutritionId,
          foodItem
        }
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Nutrition added successfully",
      NutritionID: nutritionId
    });

  } catch (error) {
    console.error("Create nutrition error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/nutrition/:nutritionId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const nutritionId = Number(req.params.nutritionId);

    const {
      MealType,
      Calories,
      Quantity,
      Date,
      FoodItems
    } = req.body;

    if (
      !MealType ||
      Calories == null ||
      Quantity == null ||
      !Date
    ) {
      return res.status(400).json({
        error: "MealType, Calories, Quantity and Date are required"
      });
    }

    const check = await connection.execute(
      `SELECT NutritionID
       FROM NUTRITION
       WHERE NutritionID = :nutritionId
       AND UserID = :userId`,
      {
        nutritionId,
        userId: req.user.UserID
      }
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        error: "Nutrition record not found or does not belong to you"
      });
    }

    await connection.execute(
      `UPDATE NUTRITION
       SET
         MealType = :mealType,
         Calories = :calories,
         Quantity = :quantity,
         "Date" = TO_DATE(:nutritionDate, 'YYYY-MM-DD')
       WHERE NutritionID = :nutritionId
       AND UserID = :userId`,
      {
        mealType: MealType,
        calories: Number(Calories),
        quantity: Number(Quantity),
        nutritionDate: Date,
        nutritionId,
        userId: req.user.UserID
      }
    );

    await connection.execute(
      `DELETE FROM NUTRITION_FOODITEM
       WHERE NutritionID = :nutritionId`,
      {
        nutritionId
      }
    );

    const foodItems = Array.isArray(FoodItems)
      ? FoodItems.filter(item => item && item.trim())
      : [];

    for (const foodItem of foodItems) {
      await connection.execute(
        `INSERT INTO NUTRITION_FOODITEM
         (NutritionID, FoodItem)
         VALUES
         (:nutritionId, :foodItem)`,
        {
          nutritionId,
          foodItem
        }
      );
    }

    await connection.commit();

    res.json({
      message: "Nutrition updated successfully"
    });

  } catch (error) {
    console.error("Update nutrition error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});


router.delete('/nutrition/:nutritionId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const nutritionId = Number(req.params.nutritionId);

    const check = await connection.execute(
      `SELECT NutritionID
       FROM NUTRITION
       WHERE NutritionID = :nutritionId
       AND UserID = :userId`,
      {
        nutritionId,
        userId: req.user.UserID
      }
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        error: "Nutrition record not found or does not belong to you"
      });
    }

    await connection.execute(
      `DELETE FROM NUTRITION_FOODITEM
       WHERE NutritionID = :nutritionId`,
      {
        nutritionId
      }
    );

    await connection.execute(
      `DELETE FROM NUTRITION
       WHERE NutritionID = :nutritionId
       AND UserID = :userId`,
      {
        nutritionId,
        userId: req.user.UserID
      }
    );

    await connection.commit();

    res.json({
      message: "Nutrition deleted successfully"
    });

  } catch (error) {
    console.error("Delete nutrition error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/goals/:goalId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const goalId = Number(req.params.goalId);

    const {
      GoalType,
      TargetValue,
      Deadline
    } = req.body;

    if (
      !GoalType ||
      TargetValue == null ||
      !Deadline
    ) {
      return res.status(400).json({
        error: "GoalType, TargetValue and Deadline are required"
      });
    }

    const result = await connection.execute(
      `UPDATE GOAL
       SET
         GoalType = :goalType,
         TargetValue = :targetValue,
         Deadline = TO_DATE(:deadline, 'YYYY-MM-DD')
       WHERE GoalID = :goalId
       AND UserID = :userId`,
      {
        goalType: GoalType,
        targetValue: Number(TargetValue),
        deadline: Deadline,
        goalId,
        userId: req.user.UserID
      },
      {
        autoCommit: true
      }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Goal not found or does not belong to you"
      });
    }

    res.json({
      message: "Goal updated successfully"
    });

  } catch (error) {
    console.error("Update goal error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.delete('/goals/:goalId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const goalId = Number(req.params.goalId);

    const result = await connection.execute(
      `DELETE FROM GOAL
       WHERE GoalID = :goalId
       AND UserID = :userId`,
      {
        goalId,
        userId: req.user.UserID
      },
      {
        autoCommit: true
      }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Goal not found or does not belong to you"
      });
    }

    res.json({
      message: "Goal deleted successfully"
    });

  } catch (error) {
    console.error("Delete goal error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/achievements/:achievementId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const achievementId = Number(req.params.achievementId);

    const {
      Title,
      Description,
      DateAwarded,
      ActivityID
    } = req.body;

    if (
      !Title ||
      !Description ||
      !DateAwarded ||
      ActivityID == null
    ) {
      return res.status(400).json({
        error: "Title, Description, DateAwarded and ActivityID are required"
      });
    }

    const ownershipCheck = await connection.execute(
      `SELECT e.AchievementID
       FROM EARNS e
       JOIN ACTIVITY a
         ON a.ActivityID = e.ActivityID
       WHERE e.AchievementID = :achievementId
       AND a.UserID = :userId`,
      {
        achievementId,
        userId: req.user.UserID
      }
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Achievement not found or does not belong to you"
      });
    }

    const activityCheck = await connection.execute(
      `SELECT ActivityID
       FROM ACTIVITY
       WHERE ActivityID = :activityId
       AND UserID = :userId`,
      {
        activityId: Number(ActivityID),
        userId: req.user.UserID
      }
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Activity not found or does not belong to you"
      });
    }

    await connection.execute(
      `UPDATE ACHIEVEMENT
       SET
         Title = :title,
         Description = :description,
         DateAwarded = TO_DATE(:dateAwarded, 'YYYY-MM-DD')
       WHERE AchievementID = :achievementId`,
      {
        title: Title,
        description: Description,
        dateAwarded: DateAwarded,
        achievementId
      }
    );

    await connection.execute(
      `UPDATE EARNS
       SET ActivityID = :activityId
       WHERE AchievementID = :achievementId`,
      {
        activityId: Number(ActivityID),
        achievementId
      }
    );

    await connection.commit();

    res.json({
      message: "Achievement updated successfully"
    });

  } catch (error) {
    console.error("Update achievement error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.delete('/achievements/:achievementId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const achievementId = Number(req.params.achievementId);

    const ownershipCheck = await connection.execute(
      `SELECT e.AchievementID
       FROM EARNS e
       JOIN ACTIVITY a
         ON a.ActivityID = e.ActivityID
       WHERE e.AchievementID = :achievementId
       AND a.UserID = :userId`,
      {
        achievementId,
        userId: req.user.UserID
      }
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Achievement not found or does not belong to you"
      });
    }

    await connection.execute(
      `DELETE FROM EARNS
       WHERE AchievementID = :achievementId`,
      {
        achievementId
      }
    );

    await connection.execute(
      `DELETE FROM ACHIEVEMENT
       WHERE AchievementID = :achievementId`,
      {
        achievementId
      }
    );

    await connection.commit();

    res.json({
      message: "Achievement deleted successfully"
    });

  } catch (error) {
    console.error("Delete achievement error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/goals', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT GoalID, GoalType, TargetValue, Deadline, UserID
       FROM GOAL
       WHERE UserID = :userId`,
      { userId: req.user.UserID }
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/goals', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      GoalType,
      TargetValue,
      Deadline
    } = req.body;

    if (!GoalType || TargetValue == null || !Deadline) {
      return res.status(400).json({
        error: "GoalType, TargetValue and Deadline are required"
      });
    }

    const result = await connection.execute(
      `INSERT INTO GOAL
       (GoalType, TargetValue, Deadline, UserID)
       VALUES
       (:goalType, :targetValue,
        TO_DATE(:deadline, 'YYYY-MM-DD'), :userId)
       RETURNING GoalID INTO :goalId`,
      {
        goalType: GoalType,
        targetValue: Number(TargetValue),
        deadline: Deadline,
        userId: req.user.UserID,
        goalId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      },
      { autoCommit: true }
    );

    res.status(201).json({
      message: "Goal created successfully",
      GoalID: result.outBinds.goalId[0]
    });

  } catch (error) {
    console.error("Create goal error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/devices/:deviceId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const deviceId = Number(req.params.deviceId);

    const {
      Brand,
      Model,
      SerialNumber,
      DeviceType,
      Features,
      HasGPS,
      WaterResistance,
      BandMaterial,
      HasHRSensor
    } = req.body;

    if (
      !Brand ||
      !Model ||
      !SerialNumber ||
      !DeviceType
    ) {
      return res.status(400).json({
        error: "Brand, Model, SerialNumber and DeviceType are required"
      });
    }

    const ownershipCheck = await connection.execute(
      `SELECT DeviceID
       FROM WEARABLE_DEVICE
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        deviceId,
        userId: req.user.UserID
      }
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Device not found or does not belong to you"
      });
    }

    await connection.execute(
      `UPDATE WEARABLE_DEVICE
       SET
         Brand = :brand,
         Model = :model,
         SerialNumber = :serialNumber
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        brand: Brand,
        model: Model,
        serialNumber: SerialNumber,
        deviceId,
        userId: req.user.UserID
      }
    );

    await connection.execute(
      `DELETE FROM DEVICE_FEATURE
       WHERE DeviceID = :deviceId`,
      {
        deviceId
      }
    );

    const features = Array.isArray(Features)
      ? Features.filter(feature => feature && feature.trim())
      : [];

    for (const feature of features) {
      
        await connection.execute(
  `INSERT INTO DEVICE_FEATURE
   (DeviceID, FeatureName)
   VALUES
   (:deviceId, :featureName)`,
  {
    deviceId,
    featureName: feature
  }
);
    }

    if (DeviceType === "Smartwatch") {

      await connection.execute(
        `DELETE FROM FITNESS_BAND
         WHERE DeviceID = :deviceId`,
        {
          deviceId
        }
      );

      const smartwatchCheck = await connection.execute(
        `SELECT DeviceID
         FROM SMARTWATCH
         WHERE DeviceID = :deviceId`,
        {
          deviceId
        }
      );

      if (smartwatchCheck.rows.length === 0) {
        await connection.execute(
          `INSERT INTO SMARTWATCH
           (DeviceID, HasGPS, WaterResistance)
           VALUES
           (:deviceId, :hasGPS, :waterResistance)`,
          {
            deviceId,
            hasGPS: HasGPS ? 1 : 0,
            waterResistance: WaterResistance || null
          }
        );
      } else {
        await connection.execute(
          `UPDATE SMARTWATCH
           SET
             HasGPS = :hasGPS,
             WaterResistance = :waterResistance
           WHERE DeviceID = :deviceId`,
          {
            hasGPS: HasGPS ? 1 : 0,
            waterResistance: WaterResistance || null,
            deviceId
          }
        );
      }

    } else if (DeviceType === "Fitness Band") {

      await connection.execute(
        `DELETE FROM SMARTWATCH
         WHERE DeviceID = :deviceId`,
        {
          deviceId
        }
      );

      const fitnessBandCheck = await connection.execute(
        `SELECT DeviceID
         FROM FITNESS_BAND
         WHERE DeviceID = :deviceId`,
        {
          deviceId
        }
      );

      if (fitnessBandCheck.rows.length === 0) {
        await connection.execute(
          `INSERT INTO FITNESS_BAND
           (DeviceID, BandMaterial, HasHRSensor)
           VALUES
           (:deviceId, :bandMaterial, :hasHRSensor)`,
          {
            deviceId,
            bandMaterial: BandMaterial || null,
            hasHRSensor: HasHRSensor ? 1 : 0
          }
        );
      } else {
        await connection.execute(
          `UPDATE FITNESS_BAND
           SET
             BandMaterial = :bandMaterial,
             HasHRSensor = :hasHRSensor
           WHERE DeviceID = :deviceId`,
          {
            bandMaterial: BandMaterial || null,
            hasHRSensor: HasHRSensor ? 1 : 0,
            deviceId
          }
        );
      }

    } else {
      return res.status(400).json({
        error: "Invalid device type"
      });
    }

    await connection.commit();

    res.json({
      message: "Device updated successfully"
    });

  } catch (error) {
    console.error("Update device error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.delete('/devices/:deviceId', auth, async (req, res) => {
  let connection;

  try {
    console.log("DELETE DEVICE START:", req.params.deviceId);

    connection = await getConnection();
    console.log("Oracle connection acquired");

    const deviceId = Number(req.params.deviceId);

    const ownershipCheck = await connection.execute(
      `SELECT DeviceID
       FROM WEARABLE_DEVICE
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        deviceId,
        userId: req.user.UserID
      }
    );

    console.log("Ownership check completed");

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Device not found or does not belong to you"
      });
    }

    console.log("Deleting HEALTH_METRIC");

    await connection.execute(
      `DELETE FROM HEALTH_METRIC
       WHERE DeviceID = :deviceId`,
      {
        deviceId
      }
    );

    console.log("Deleting DEVICE_FEATURE");

    await connection.execute(
      `DELETE FROM DEVICE_FEATURE
       WHERE DeviceID = :deviceId`,
      {
        deviceId
      }
    );

    console.log("Deleting SMARTWATCH");

    await connection.execute(
      `DELETE FROM SMARTWATCH
       WHERE DeviceID = :deviceId`,
      {
        deviceId
      }
    );

    console.log("Deleting FITNESS_BAND");

    await connection.execute(
      `DELETE FROM FITNESS_BAND
       WHERE DeviceID = :deviceId`,
      {
        deviceId
      }
    );

    console.log("Deleting WEARABLE_DEVICE");

    await connection.execute(
      `DELETE FROM WEARABLE_DEVICE
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        deviceId,
        userId: req.user.UserID
      }
    );

    await connection.commit();

    console.log("DELETE DEVICE SUCCESS");

    res.json({
      message: "Device deleted successfully"
    });

  } catch (error) {
    console.error("Delete device error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
      console.log("Oracle connection closed");
    }
  }
});
router.get('/devices', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         w.DeviceID,
         w.Brand,
         w.Model,
         w.SerialNumber,
         w.UserID,
         CASE
           WHEN s.DeviceID IS NOT NULL THEN 'Smartwatch'
           WHEN fb.DeviceID IS NOT NULL THEN 'Fitness Band'
           ELSE 'Smartwatch'
         END AS DeviceType,
         CASE
           WHEN s.DeviceID IS NOT NULL THEN s.HasGPS
           ELSE NULL
         END AS HasGPS,
         CASE
           WHEN s.DeviceID IS NOT NULL THEN s.WaterResistance
           ELSE NULL
         END AS WaterResistance,
         CASE
           WHEN fb.DeviceID IS NOT NULL THEN fb.BandMaterial
           ELSE NULL
         END AS BandMaterial,
         CASE
           WHEN fb.DeviceID IS NOT NULL THEN fb.HasHRSensor
           ELSE NULL
         END AS HasHRSensor,
         (
           SELECT LISTAGG(df.FeatureName, ', ')
                  WITHIN GROUP (ORDER BY df.FeatureName)
           FROM DEVICE_FEATURE df
           WHERE df.DeviceID = w.DeviceID
         ) AS Features
       FROM WEARABLE_DEVICE w
       LEFT JOIN SMARTWATCH s
         ON s.DeviceID = w.DeviceID
       LEFT JOIN FITNESS_BAND fb
         ON fb.DeviceID = w.DeviceID
       WHERE w.UserID = :userId
       ORDER BY w.DeviceID`,
      { userId: req.user.UserID }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/devices', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      Brand,
      Model,
      SerialNumber,
      Features,
      DeviceType,
      HasGPS,
      WaterResistance,
      BandMaterial,
      HasHRSensor
    } = req.body;

    if (!Brand || !Model || !SerialNumber) {
      return res.status(400).json({
        error: "Brand, Model and SerialNumber are required"
      });
    }

    const deviceResult = await connection.execute(
      `INSERT INTO WEARABLE_DEVICE
       (Brand, Model, SerialNumber, UserID)
       VALUES
       (:brand, :model, :serialNumber, :userId)
       RETURNING DeviceID INTO :deviceId`,
      {
        brand: Brand,
        model: Model,
        serialNumber: SerialNumber,
        userId: req.user.UserID,
        deviceId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      }
    );

    const deviceId = deviceResult.outBinds.deviceId[0];

    const features = Array.isArray(Features)
      ? Features.filter(feature => feature && feature.trim())
      : [];

    for (const feature of features) {
      await connection.execute(
        `INSERT INTO DEVICE_FEATURE
         (DeviceID, FeatureName)
         VALUES
         (:deviceId, :featureName)`,
        {
          deviceId,
          featureName: feature
        }
      );
    }

    if (DeviceType === "Smartwatch") {
      await connection.execute(
        `INSERT INTO SMARTWATCH
         (DeviceID, HasGPS, WaterResistance)
         VALUES
         (:deviceId, :hasGPS, :waterResistance)`,
        {
          deviceId,
          hasGPS: HasGPS ? "Yes" : "No",
          waterResistance: WaterResistance || null
        }
      );
    }

    if (DeviceType === "Fitness Band") {
      await connection.execute(
        `INSERT INTO FITNESS_BAND
         (DeviceID, BandMaterial, HasHRSensor)
         VALUES
         (:deviceId, :bandMaterial, :hasHRSensor)`,
        {
          deviceId,
          bandMaterial: BandMaterial || null,
          hasHRSensor: HasHRSensor ? "Yes" : "No"
        }
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Device created successfully",
      DeviceID: deviceId
    });

  } catch (error) {
    console.error("Create device error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});


router.get('/trainers', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         t.UserID AS "TrainerID",
         u.FirstName AS "TrainerFirstName",
         u.LastName AS "TrainerLastName",
         t.CertificationNo AS "CertificationNo",
         t.YearsExperience AS "YearsExperience",
         COUNT(DISTINCT s.UserID) AS "AthleteCount"
       FROM TRAINER t
       JOIN USERS u
         ON t.UserID = u.UserID
       LEFT JOIN SUPERVISION s
         ON s.TrainerID = t.UserID
       GROUP BY
         t.UserID,
         u.FirstName,
         u.LastName,
         t.CertificationNo,
         t.YearsExperience
       ORDER BY t.UserID`,
      {}
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get trainers error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/health', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         h.DeviceID,
         h.MetricID,
         h.MetricType,
         h.Value,
         h.Unit,
         h.Timestamp,
         w.Brand,
         w.Model
       FROM HEALTH_METRIC h
       JOIN WEARABLE_DEVICE w
         ON h.DeviceID = w.DeviceID
       WHERE w.UserID = :userId
       ORDER BY h.Timestamp DESC`,
      { userId: req.user.UserID }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get health metrics error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/health', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      DeviceID,
      MetricType,
      Value,
      Unit,
      Timestamp
    } = req.body;

    if (
      DeviceID == null ||
      !MetricType ||
      Value == null ||
      !Unit ||
      !Timestamp
    ) {
      return res.status(400).json({
        error: "DeviceID, MetricType, Value, Unit and Timestamp are required"
      });
    }

    const deviceCheck = await connection.execute(
      `SELECT DeviceID
       FROM WEARABLE_DEVICE
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        deviceId: Number(DeviceID),
        userId: req.user.UserID
      }
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({
        error: "You can only add health metrics to your own device"
      });
    }

    const result = await connection.execute(
      `INSERT INTO HEALTH_METRIC
       (DeviceID, MetricType, Value, Unit, Timestamp)
       VALUES
       (:deviceId, :metricType, :metricValue, :metricUnit,
        TO_TIMESTAMP(:metricTimestamp, 'YYYY-MM-DD HH24:MI:SS'))
       RETURNING MetricID INTO :metricId`,
      {
        deviceId: Number(DeviceID),
        metricType: MetricType,
        metricValue: Number(Value),
        metricUnit: Unit,
        metricTimestamp: Timestamp,
        metricId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      },
      { autoCommit: true }
    );

    // Sync write to InfluxDB (non-fatal if InfluxDB is offline)
    try {
      const writeApi = getWriteApi();
      const point = new Point('health_metric')
        .tag('userId', String(req.user.UserID))
        .tag('deviceId', String(DeviceID))
        .tag('metricType', String(MetricType).toUpperCase())
        .tag('unit', String(Unit))
        .floatField('value', Number(Value))
        .timestamp(new Date(Timestamp));
      writeApi.writePoint(point);
      await flushWrites();
    } catch (infErr) {
      console.warn('InfluxDB dual-write notice:', infErr.message);
    }

    res.status(201).json({
      message: "Health metric added successfully",
      MetricID: result.outBinds.metricId[0]
    });

  } catch (error) {
    console.error("Create health metric error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/health/:metricId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const metricId = Number(req.params.metricId);

    const {
      DeviceID,
      MetricType,
      Value,
      Unit,
      Timestamp
    } = req.body;

    if (
      DeviceID == null ||
      !MetricType ||
      Value == null ||
      !Unit ||
      !Timestamp
    ) {
      return res.status(400).json({
        error: "DeviceID, MetricType, Value, Unit and Timestamp are required"
      });
    }

    const ownershipCheck = await connection.execute(
      `SELECT h.MetricID
       FROM HEALTH_METRIC h
       JOIN WEARABLE_DEVICE w
         ON h.DeviceID = w.DeviceID
       WHERE h.MetricID = :metricId
       AND w.UserID = :userId`,
      {
        metricId,
        userId: req.user.UserID
      }
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Health metric not found or does not belong to you"
      });
    }

    const deviceCheck = await connection.execute(
      `SELECT DeviceID
       FROM WEARABLE_DEVICE
       WHERE DeviceID = :deviceId
       AND UserID = :userId`,
      {
        deviceId: Number(DeviceID),
        userId: req.user.UserID
      }
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({
        error: "You can only use your own device"
      });
    }

    await connection.execute(
      `UPDATE HEALTH_METRIC
       SET DeviceID = :deviceId,
           MetricType = :metricType,
           Value = :metricValue,
           Unit = :metricUnit,
           Timestamp = TO_TIMESTAMP(
             :metricTimestamp,
             'YYYY-MM-DD HH24:MI:SS'
           )
       WHERE MetricID = :metricId`,
      {
        deviceId: Number(DeviceID),
        metricType: MetricType,
        metricValue: Number(Value),
        metricUnit: Unit,
        metricTimestamp: Timestamp,
        metricId
      }
    );

    await connection.commit();

    // Sync update to InfluxDB (non-fatal if InfluxDB is offline)
    try {
      const writeApi = getWriteApi();
      const point = new Point('health_metric')
        .tag('userId', String(req.user.UserID))
        .tag('deviceId', String(DeviceID))
        .tag('metricType', String(MetricType).toUpperCase())
        .tag('unit', String(Unit))
        .floatField('value', Number(Value))
        .timestamp(new Date(Timestamp));
      writeApi.writePoint(point);
      await flushWrites();
    } catch (infErr) {
      console.warn('InfluxDB dual-update notice:', infErr.message);
    }

    res.json({
      message: "Health metric updated successfully"
    });

  } catch (error) {
    console.error("Update health metric error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.delete('/health/:metricId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const metricId = Number(req.params.metricId);

    const ownershipCheck = await connection.execute(
      `SELECT h.MetricID, h.MetricType, h.Timestamp, h.DeviceID
       FROM HEALTH_METRIC h
       JOIN WEARABLE_DEVICE w
         ON h.DeviceID = w.DeviceID
       WHERE h.MetricID = :metricId
       AND w.UserID = :userId`,
      {
        metricId,
        userId: req.user.UserID
      }
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Health metric not found or does not belong to you"
      });
    }

    const metricRow = ownershipCheck.rows[0];

    await connection.execute(
      `DELETE FROM HEALTH_METRIC
       WHERE MetricID = :metricId`,
      {
        metricId
      }
    );

    await connection.commit();

    // Sync delete from InfluxDB (non-fatal if InfluxDB is offline)
    try {
      if (metricRow && metricRow.TIMESTAMP) {
        const targetTime = new Date(metricRow.TIMESTAMP).getTime();
        const start = new Date(targetTime - 10).toISOString();
        const stop = new Date(targetTime + 10).toISOString();
        const metricType = String(metricRow.METRICTYPE).toUpperCase();
        await deleteData({
          start,
          stop,
          predicate: `_measurement="health_metric" AND metricType="${metricType}" AND userId="${req.user.UserID}"`
        });
      }
    } catch (infErr) {
      console.warn('InfluxDB dual-delete notice:', infErr.message);
    }

    res.json({
      message: "Health metric deleted successfully"
    });

  } catch (error) {
    console.error("Delete health metric error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/achievements', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         a.AchievementID AS "AchievementID",
         a.Title AS "Title",
         a.Description AS "Description",
         TO_CHAR(a.DateAwarded, 'YYYY-MM-DD') AS "DateAwarded",
         e.ActivityID AS "ActivityID",
         act.Type AS "ActivityType",
         act.Distance AS "Distance",
         act.Duration AS "Duration",
         TO_CHAR(act."Date", 'YYYY-MM-DD') AS "ActivityDate"
       FROM ACHIEVEMENT a
       JOIN EARNS e
         ON a.AchievementID = e.AchievementID
       JOIN ACTIVITY act
         ON e.ActivityID = act.ActivityID
       WHERE act.UserID = :userId
       ORDER BY a.DateAwarded DESC`,
      {
        userId: req.user.UserID
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get achievements error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/achievements', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      Title,
      Description,
      DateAwarded,
      ActivityID
    } = req.body;

    if (!Title || !Description || !DateAwarded || ActivityID == null) {
      return res.status(400).json({
        error: "Title, Description, DateAwarded and ActivityID are required"
      });
    }

    const activityCheck = await connection.execute(
      `SELECT ActivityID
       FROM ACTIVITY
       WHERE ActivityID = :activityId
       AND UserID = :userId`,
      {
        activityId: Number(ActivityID),
        userId: req.user.UserID
      }
    );

    if (activityCheck.rows.length === 0) {
      return res.status(403).json({
        error: "You can only create achievements for your own activities"
      });
    }

    const achievementResult = await connection.execute(
      `INSERT INTO ACHIEVEMENT
       (Title, Description, DateAwarded)
       VALUES
       (:title, :description,
        TO_DATE(:dateAwarded, 'YYYY-MM-DD'))
       RETURNING AchievementID INTO :achievementId`,
      {
        title: Title,
        description: Description,
        dateAwarded: DateAwarded,
        achievementId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      }
    );

    const achievementId =
      achievementResult.outBinds.achievementId[0];

    await connection.execute(
      `INSERT INTO EARNS
       (ActivityID, AchievementID)
       VALUES
       (:activityId, :achievementId)`,
      {
        activityId: Number(ActivityID),
        achievementId
      }
    );

    await connection.commit();

    res.status(201).json({
      message: "Achievement created successfully",
      AchievementID: achievementId
    });

  } catch (error) {
    console.error("Create achievement error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/social/users', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.UserID,
         u.FirstName,
         u.LastName,
         u.Email,
         CASE
           WHEN uf.FollowerID IS NOT NULL THEN 1
           ELSE 0
         END AS IsFollowing
       FROM USERS u
       LEFT JOIN USER_FOLLOWS uf
         ON uf.FolloweeID = u.UserID
        AND uf.FollowerID = :userId
       WHERE u.UserID != :userId
       ORDER BY u.UserID`,
      {
        userId: req.user.UserID
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get social users error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/social/follow/:userId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const followeeId = Number(req.params.userId);
    const followerId = req.user.UserID;

    if (followeeId === followerId) {
      return res.status(400).json({
        error: "You cannot follow yourself"
      });
    }

    const userCheck = await connection.execute(
      `SELECT UserID
       FROM USERS
       WHERE UserID = :userId`,
      {
        userId: followeeId
      }
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const existing = await connection.execute(
      `SELECT FollowerID
       FROM USER_FOLLOWS
       WHERE FollowerID = :followerId
       AND FolloweeID = :followeeId`,
      {
        followerId,
        followeeId
      }
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "Already following this user"
      });
    }

    await connection.execute(
      `INSERT INTO USER_FOLLOWS
       (FollowerID, FolloweeID)
       VALUES
       (:followerId, :followeeId)`,
      {
        followerId,
        followeeId
      }
    );

    await connection.commit();

    res.status(201).json({
      message: "User followed successfully"
    });

  } catch (error) {
    console.error("Follow user error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});router.delete('/social/follow/:userId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const followeeId = Number(req.params.userId);
    const followerId = req.user.UserID;

    await connection.execute(
      `DELETE FROM USER_FOLLOWS
       WHERE FollowerID = :followerId
       AND FolloweeID = :followeeId`,
      {
        followerId,
        followeeId
      }
    );

    await connection.commit();

    res.json({
      message: "User unfollowed successfully"
    });

  } catch (error) {
    console.error("Unfollow user error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});router.get('/social/followers', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.UserID,
         u.FirstName,
         u.LastName,
         u.Email
       FROM USER_FOLLOWS uf
       JOIN USERS u
         ON u.UserID = uf.FollowerID
       WHERE uf.FolloweeID = :userId
       ORDER BY u.UserID`,
      {
        userId: req.user.UserID
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get followers error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});router.get('/social/following', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.UserID,
         u.FirstName,
         u.LastName,
         u.Email
       FROM USER_FOLLOWS uf
       JOIN USERS u
         ON u.UserID = uf.FolloweeID
       WHERE uf.FollowerID = :userId
       ORDER BY u.UserID`,
      {
        userId: req.user.UserID
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get following error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/trainers/:trainerId/athletes', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const trainerId = Number(req.params.trainerId);

    const result = await connection.execute(
      `SELECT
         s.TrainerID AS "TrainerID",
         s.UserID AS "AthleteID",
         u.FirstName AS "AthleteFirstName",
         u.LastName AS "AthleteLastName",
         a.SportType AS "SportType",
         a.SkillLevel AS "SkillLevel",
         s.ActivityID AS "ActivityID",
         act.Type AS "ActivityType",
         act.Duration AS "Duration",
         act.Distance AS "Distance",
         TO_CHAR(act."Date", 'YYYY-MM-DD') AS "ActivityDate",
         s.SessionNotes AS "SessionNotes",
         s.PerformanceRating AS "PerformanceRating"
       FROM SUPERVISION s
       JOIN USERS u
         ON u.UserID = s.UserID
       JOIN ATHLETE a
         ON a.UserID = s.UserID
       JOIN ACTIVITY act
         ON act.ActivityID = s.ActivityID
       WHERE s.TrainerID = :trainerId
       ORDER BY s.UserID, act."Date" DESC`,
      {
        trainerId
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get trainer athletes error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/notifications', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         n.RecipientID AS "RecipientID",
         n.SourceType AS "SourceType",
         n.UserID AS "UserID",
         u.FirstName AS "FirstName",
         u.LastName AS "LastName",
         n.TrainerUserID AS "TrainerUserID",
         tu.FirstName AS "TrainerFirstName",
         tu.LastName AS "TrainerLastName",
         n.ContactChannel AS "ContactChannel",
         n.NotificationPref AS "NotificationPref"
       FROM NOTIFICATION_RECIPIENT n
       JOIN USERS u
         ON n.UserID = u.UserID
       LEFT JOIN TRAINER t
         ON n.TrainerUserID = t.UserID
       LEFT JOIN USERS tu
         ON t.UserID = tu.UserID
       WHERE n.UserID = :userId
       ORDER BY n.RecipientID`,
      {
        userId: req.user.UserID
      }
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/notifications', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      SourceType,
      TrainerUserID,
      ContactChannel,
      NotificationPref
    } = req.body;

    if (
      !SourceType ||
      !ContactChannel ||
      !NotificationPref
    ) {
      return res.status(400).json({
        error: "SourceType, ContactChannel and NotificationPref are required"
      });
    }

    if (TrainerUserID != null) {
      const trainerCheck = await connection.execute(
        `SELECT UserID
         FROM TRAINER
         WHERE UserID = :trainerUserId`,
        {
          trainerUserId: Number(TrainerUserID)
        }
      );

      if (trainerCheck.rows.length === 0) {
        return res.status(400).json({
          error: "Invalid trainer"
        });
      }
    }

    const result = await connection.execute(
      `INSERT INTO NOTIFICATION_RECIPIENT
       (
         SourceType,
         UserID,
         TrainerUserID,
         ContactChannel,
         NotificationPref
       )
       VALUES
       (
         :sourceType,
         :userId,
         :trainerUserId,
         :contactChannel,
         :notificationPref
       )
       RETURNING RecipientID INTO :recipientId`,
      {
        sourceType: SourceType,
        userId: req.user.UserID,
        trainerUserId:
          TrainerUserID != null
            ? Number(TrainerUserID)
            : null,
        contactChannel: ContactChannel,
        notificationPref: NotificationPref,
        recipientId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER
        }
      },
      {
        autoCommit: true
      }
    );

    res.status(201).json({
      message: "Notification setting created successfully",
      RecipientID: result.outBinds.recipientId[0]
    });

  } catch (error) {
    console.error("Create notification error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.delete('/notifications/:recipientId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const recipientId = Number(req.params.recipientId);

    const result = await connection.execute(
      `DELETE FROM NOTIFICATION_RECIPIENT
       WHERE RecipientID = :recipientId
       AND UserID = :userId`,
      {
        recipientId,
        userId: req.user.UserID
      },
      {
        autoCommit: true
      }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Notification setting not found"
      });
    }

    res.json({
      message: "Notification setting deleted successfully"
    });

  } catch (error) {
    console.error("Delete notification error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/profile', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.UserID AS "UserID",
         u.FirstName AS "FirstName",
         u.LastName AS "LastName",
         u.Email AS "Email",
         TO_CHAR(u.DOB, 'YYYY-MM-DD') AS "DOB",
         u.Gender AS "Gender",
         p.PhoneNumber AS "PhoneNumber"
       FROM USERS u
       LEFT JOIN USER_PHONE p
         ON u.UserID = p.UserID
       WHERE u.UserID = :userId`,
      {
        userId: req.user.UserID
      }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.put('/profile', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      FirstName,
      LastName,
      Email,
      DOB,
      Gender,
      PhoneNumber
    } = req.body;

    if (!FirstName || !LastName || !Email || !DOB || !Gender) {
      return res.status(400).json({
        error: "FirstName, LastName, Email, DOB and Gender are required"
      });
    }

    await connection.execute(
      `UPDATE USERS
       SET
         FirstName = :firstName,
         LastName = :lastName,
         Email = :email,
         DOB = TO_DATE(:dob, 'YYYY-MM-DD'),
         Gender = :gender
       WHERE UserID = :userId`,
      {
        firstName: FirstName,
        lastName: LastName,
        email: Email,
        dob: DOB,
        gender: Gender,
        userId: req.user.UserID
      }
    );

    if (PhoneNumber && PhoneNumber.trim() !== "") {

      const phoneCheck = await connection.execute(
        `SELECT UserID
         FROM USER_PHONE
         WHERE UserID = :userId`,
        {
          userId: req.user.UserID
        }
      );

      if (phoneCheck.rows.length > 0) {
        await connection.execute(
          `UPDATE USER_PHONE
           SET PhoneNumber = :phoneNumber
           WHERE UserID = :userId`,
          {
            phoneNumber: PhoneNumber.trim(),
            userId: req.user.UserID
          }
        );
      } else {
        await connection.execute(
          `INSERT INTO USER_PHONE
           (UserID, PhoneNumber)
           VALUES
           (:userId, :phoneNumber)`,
          {
            userId: req.user.UserID,
            phoneNumber: PhoneNumber.trim()
          }
        );
      }

    } else {
      await connection.execute(
        `DELETE FROM USER_PHONE
         WHERE UserID = :userId`,
        {
          userId: req.user.UserID
        }
      );
    }

    await connection.commit();

    res.json({
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.error("Update profile error:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post('/sql', auth, async (req, res) => {
  let connection;

  try {
    const { sql } = req.body;

    if (!sql || !sql.trim()) {
      return res.status(400).json({
        error: 'SQL query is required'
      });
    }

    const script = sql.trim();

    const statements = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    const lines = script.split(/\r?\n/);
    let plsqlMode = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (
        !plsqlMode &&
        /^(BEGIN|DECLARE)\b/i.test(trimmed)
      ) {
        plsqlMode = true;
      }

      if (
        !plsqlMode &&
        /^CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|TRIGGER|PACKAGE)\b/i.test(trimmed)
      ) {
        plsqlMode = true;
      }

      if (plsqlMode && trimmed === '/') {
        if (current.trim()) {
          statements.push(current.trim());
        }

        current = '';
        plsqlMode = false;
        continue;
      }

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === "'" && !inDoubleQuote) {
          if (inSingleQuote && nextChar === "'") {
            current += "''";
            i++;
            continue;
          }

          inSingleQuote = !inSingleQuote;
        }

        if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        }

        if (
          char === ';' &&
          !inSingleQuote &&
          !inDoubleQuote &&
          !plsqlMode
        ) {
          if (current.trim()) {
            statements.push(current.trim());
          }

          current = '';
          continue;
        }

        current += char;
      }

      current += '\n';
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    if (statements.length === 0) {
      return res.status(400).json({
        error: 'No SQL statement found'
      });
    }

    connection = await getConnection();

    let lastRows = [];
    let lastRowCount = 0;
    let totalRowsAffected = 0;

    for (const statement of statements) {
      const result = await connection.execute(
        statement,
        {},
        {
          autoCommit: true,
          callTimeout: 30000
        }
      );

      if (result.rows) {
        lastRows = result.rows;
        lastRowCount = result.rows.length;
      }

      if (result.rowsAffected) {
        totalRowsAffected += result.rowsAffected;
      }
    }

    const rows = lastRows.map(row => {
      const formattedRow = {};

      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          formattedRow[key] = value.toISOString();
        } else if (typeof value === 'bigint') {
          formattedRow[key] = value.toString();
        } else {
          formattedRow[key] = value;
        }
      }

      return formattedRow;
    });

    res.json({
      rows,
      rowCount: lastRowCount,
      rowsAffected: totalRowsAffected,
      statementsExecuted: statements.length,
      message: 'SQL script executed successfully'
    });

  } catch (error) {
    console.error('SQL execution error:', error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get('/sql/tables', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(`
      SELECT TABLE_NAME
      FROM USER_TABLES
      ORDER BY TABLE_NAME
    `);

    res.json({
      tables: result.rows.map(row => row.TABLE_NAME)
    });

  } catch (error) {
    console.error('Schema fetch error:', error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.get('/trainer-users', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         UserID,
         FirstName,
         LastName,
         Email
       FROM USERS
       ORDER BY FirstName, LastName`
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Get trainer users error:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.post('/trainers', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const {
      UserID,
      CertificationNo,
      YearsExperience
    } = req.body;

    if (
      UserID == null ||
      !CertificationNo ||
      YearsExperience == null
    ) {
      return res.status(400).json({
        error: "UserID, CertificationNo and YearsExperience are required"
      });
    }

    const userCheck = await connection.execute(
      `SELECT UserID
       FROM USERS
       WHERE UserID = :userId`,
      {
        userId: Number(UserID)
      }
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const trainerCheck = await connection.execute(
      `SELECT UserID
       FROM TRAINER
       WHERE UserID = :userId`,
      {
        userId: Number(UserID)
      }
    );

    if (trainerCheck.rows.length > 0) {
      return res.status(409).json({
        error: "This user is already a trainer"
      });
    }

    await connection.execute(
      `INSERT INTO TRAINER
       (UserID, CertificationNo, YearsExperience)
       VALUES
       (:userId, :certificationNo, :yearsExperience)`,
      {
        userId: Number(UserID),
        certificationNo: CertificationNo,
        yearsExperience: Number(YearsExperience)
      }
    );

    await connection.commit();

    res.status(201).json({
      message: "User added as trainer successfully"
    });

  } catch (error) {
    console.error("Create trainer error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
router.delete('/trainers/:userId', auth, async (req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const userId = Number(req.params.userId);

    const trainerCheck = await connection.execute(
      `SELECT UserID
       FROM TRAINER
       WHERE UserID = :userId`,
      {
        userId
      }
    );

    if (trainerCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Trainer not found"
      });
    }

    const supervisionCheck = await connection.execute(
      `SELECT COUNT(*) AS COUNT
       FROM SUPERVISION
       WHERE TrainerID = :trainerId`,
      {
        trainerId: userId
      }
    );

    const supervisionCount = Number(
      supervisionCheck.rows[0].COUNT
    );

    if (supervisionCount > 0) {
      return res.status(409).json({
        error: "Cannot delete trainer while they have supervised athletes"
      });
    }

    await connection.execute(
      `DELETE FROM TRAINER
       WHERE UserID = :userId`,
      {
        userId
      }
    );

    await connection.commit();

    res.json({
      message: "Trainer profile deleted successfully"
    });

  } catch (error) {
    console.error("Delete trainer error:", error);

    if (connection) {
      await connection.rollback();
    }

    res.status(500).json({
      error: error.message
    });

  } finally {
    if (connection) {
      await connection.close();
    }
  }
});
module.exports = router;