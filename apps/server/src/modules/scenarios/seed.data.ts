import type { ScenarioScript } from '@police/shared';

// 三个初始训练情景剧本（后续可在管理后台增删改查）
export const SEED_SCENARIOS: ScenarioScript[] = [
  {
    id: 'scn_car_crash',
    title: '“妈妈”遭遇车祸，急需垫付医药费',
    fraudType: '冒充亲友求助',
    difficulty: 2,
    estMinutes: 6,
    description: '“妈妈”来电称遭遇车祸急需手术押金，不断催促你转账。可拨打多个电话核实，识破冒充亲友的套路。',
    characters: {
      mom: { name: '妈妈', persona: '语气焦急、略带哭腔、不断催促。你是冒充妈妈的骗子，目标是诱导对方尽快转账。', voice: 'female_middle' },
      hospital: {
        name: '医院急诊科',
        persona: '冷静、公事公办的医院工作人员。重要事实：今天急诊科没有收治任何车祸病人。',
        voice: 'female_middle',
      },
      realmom: {
        name: '妈妈（真实号码）',
        persona: '正常、疑惑的妈妈。重要事实：她本人安然无恙，正在家里，今天根本没有出车祸，也没去过医院。',
        voice: 'female_middle',
      },
      police: {
        name: '110 接警员',
        persona: '冷静、专业的 110 接警员。会受理报警、记录警情、安抚报警人，并告知会安排出警。',
        voice: 'female_middle',
      },
    },
    opening: {
      speaker: 'mom',
      channel: 'text',
      content:
        '孩子，妈刚才过马路被车撞了，现在人在医院，医生说需要先交 3 万押金才能手术，你赶紧把钱转过来……',
    },
    beats: [
      {
        id: 'b1',
        speaker: 'mom',
        channel: 'text',
        content: '妈现在疼得厉害，医生一直在催，你先转过来，妈回头一定还你。',
        allowFreeText: true,
        options: [
          { label: '先核实对方是不是本人（会接到对方来电）', next: 'b2_verify', score: { identityCheck: 20 } },
          { label: '打电话向医院核实（会打医院电话）', next: 'b_hospital', score: { identityCheck: 30 } },
          { label: '打妈妈的真实号码核实（会打妈妈电话）', next: 'b_realmom', score: { identityCheck: 30 } },
          { label: '情况紧急，立即转账', trigger: 'transfer' },
        ],
        next: 'b2_ask',
      },
      {
        id: 'b2_ask',
        speaker: 'mom',
        channel: 'text',
        content: '就在市人民医院急诊科！你问这些干什么，赶紧转钱，晚了妈这条腿就保不住了……',
        options: [
          { label: '打医院总机核实（会打医院电话）', next: 'b_hospital', score: { identityCheck: 30 } },
          { label: '打妈妈真实号码核实（会打妈妈电话）', next: 'b_realmom', score: { identityCheck: 30 } },
          { label: '立即转账', trigger: 'transfer' },
        ],
        next: 'b3_truth',
      },
      {
        id: 'b2_verify',
        speaker: 'mom',
        channel: 'voice_call',
        content: '你连妈都不信了？妈现在都这样了，你还在怀疑我？快点啊孩子！',
        voiceParams: { tone: 'crying_urgent', pauseMs: 300, breath: 'heavy' },
        next: 'b3_truth',
      },
      {
        id: 'b_hospital',
        speaker: 'hospital',
        channel: 'voice_call',
        content: '您好，这里是市人民医院急诊科，请问有什么可以帮您？',
        voiceParams: { tone: 'calm', pauseMs: 200, breath: 'normal' },
        next: 'b3_truth',
      },
      {
        id: 'b_realmom',
        speaker: 'realmom',
        channel: 'voice_call',
        content: '喂？孩子，怎么啦？这么着急。',
        voiceParams: { tone: 'normal', pauseMs: 200, breath: 'normal' },
        next: 'b3_truth',
      },
      {
        id: 'b3_truth',
        speaker: 'system',
        channel: 'system',
        content:
          '你通过独立渠道核实：妈妈本人安然无恙在家，医院也没有收治该病人。这是一场冒充亲友的诈骗。',
        options: [
          { label: '拨打 110 报警', trigger: 'report' },
          { label: '拉黑并举报该号码', trigger: 'block' },
          { label: '万一是真的呢，还是先转钱', trigger: 'transfer' },
        ],
      },
    ],
    endings: {
      victim: { title: '被骗', description: '未做身份核验就转账，落入冒充亲友的圈套。' },
      defended: {
        title: '成功识破',
        description: '通过独立渠道核实身份，识破了冒充亲友诈骗并报警/拉黑。',
      },
    },
    triggers: {
      transfer: { label: '立即转账', ending: 'victim', dimension: 'fundSafety', delta: -60 },
      report: { label: '拨打110报警', ending: 'defended', dimension: 'emergencyResponse', delta: 40 },
      block: { label: '拉黑举报', ending: 'defended', dimension: 'emergencyResponse', delta: 30 },
    },
    contacts: [
      {
        key: 'realmom',
        name: '妈妈（常用号码）',
        description: '家庭号码',
        persona: '正常、疑惑的妈妈。重要事实：她本人安然无恙，正在家里，今天根本没有出车祸，也没去过医院。',
        voice: 'female_middle',
        opening: '喂？孩子，怎么啦？',
        voiceParams: { tone: 'normal' },
      },
      {
        key: 'hospital',
        name: '市人民医院',
        description: '急诊科',
        persona: '冷静、公事公办的医院工作人员。重要事实：今天急诊科没有收治任何车祸病人。',
        voice: 'female_middle',
        opening: '您好，这里是市人民医院急诊科，请问有什么可以帮您？',
        voiceParams: { tone: 'calm' },
      },
      {
        key: 'police',
        name: '110 报警',
        description: '报警电话',
        persona: '冷静、专业的 110 接警员。会受理报警、记录警情、安抚报警人，并告知会安排出警。',
        voice: 'female_middle',
        opening: '您好，这里是 110 接警中心，请问有什么紧急情况？',
        voiceParams: { tone: 'calm' },
      },
    ],
  },
  {
    id: 'scn_refund',
    title: '虚假客服退款',
    fraudType: '冒充客服退款',
    difficulty: 3,
    estMinutes: 6,
    description: '“客服”称商品质量问题双倍退款，诱导你点击链接、提供银行卡与验证码、开启屏幕共享。',
    characters: {
      cs: { name: '客服小美', persona: '热情、专业、步步诱导。你是冒充电商客服的骗子，目标是诱导对方提供银行卡号、验证码或开启屏幕共享。', voice: 'female_young' },
    },
    opening: {
      speaker: 'cs',
      channel: 'text',
      content:
        '亲，您好！您近期购买的商品经检测有质量问题，现为您办理“双倍退款”，请点击链接填写退款信息哦～',
    },
    beats: [
      {
        id: 'b1',
        speaker: 'cs',
        channel: 'image',
        content: '对方发来一张「退款中心」截图（伪造的退款申请链接页面）',
        imagePrompt:
          '一张仿冒电商平台“退款中心”的页面截图，标题“双倍理赔”，带输入银行卡号的表单，配色仿主流电商App',
        options: [
          { label: '先登录官方 App 核实订单', next: 'b2_verify', score: { privacyProtection: 25 } },
          { label: '问为什么要提供银行卡', next: 'b2_ask', score: { privacyProtection: 10 } },
          { label: '点击链接填写银行卡号', trigger: 'disclose' },
        ],
        next: 'b2_ask',
      },
      {
        id: 'b2_verify',
        speaker: 'cs',
        channel: 'text',
        content: '亲，我们这边有您的订单信息，双倍退需要走专属通道，请配合一下嘛，很快的～',
        options: [
          { label: '坚持走官方 App 内的退款入口', next: 'b3_truth', score: { privacyProtection: 25, fundSafety: 10 } },
          { label: '提供银行卡号试试', trigger: 'disclose' },
        ],
        next: 'b3_truth',
      },
      {
        id: 'b2_ask',
        speaker: 'cs',
        channel: 'text',
        content:
          '退款需要验证您的收款账户，麻烦提供银行卡号、预留手机号，稍后会有验证码，把验证码也告诉我一下～',
        options: [
          { label: '意识到“要验证码=要转账”，拒绝并举报', trigger: 'block' },
          { label: '提供卡号和验证码', trigger: 'disclose' },
          { label: '拨打开卡行客服核实', next: 'b3_truth', score: { identityCheck: 20, fundSafety: 15 } },
        ],
        next: 'b3_truth',
      },
      {
        id: 'b3_truth',
        speaker: 'system',
        channel: 'system',
        content:
          '你核实后发现：官方 App 无任何退款工单，正规客服也绝不会索要验证码或要求开启屏幕共享。这是一起典型的冒充客服退款诈骗。',
        options: [
          { label: '拨打 110 报警', trigger: 'report' },
          { label: '拉黑举报', trigger: 'block' },
        ],
      },
    ],
    endings: {
      victim: { title: '被骗', description: '泄露了银行卡号与验证码，卡内资金被转走。' },
      defended: {
        title: '成功识破',
        description: '拒绝提供验证码与屏幕共享，走官方渠道核实并举报。',
      },
    },
    triggers: {
      disclose: {
        label: '提供卡号/验证码/屏幕共享',
        ending: 'victim',
        dimension: 'privacyProtection',
        delta: -60,
      },
      report: { label: '拨打110报警', ending: 'defended', dimension: 'emergencyResponse', delta: 40 },
      block: { label: '拉黑举报', ending: 'defended', dimension: 'emergencyResponse', delta: 30 },
    },
  },
  {
    id: 'scn_brushing',
    title: '校园兼职刷单',
    fraudType: '兼职刷单',
    difficulty: 4,
    estMinutes: 7,
    description: '“兼职”宣称动动手指刷单返利，先给甜头再诱你垫资大额。识破刷单返利诈骗。',
    characters: {
      agent: { name: '派单员', persona: '热情、晒收益、制造紧迫感。你是刷单诈骗的派单员，目标是用小额返利诱导对方垫付大额资金。', voice: 'male_young' },
    },
    opening: {
      speaker: 'agent',
      channel: 'text',
      content:
        '同学你好！诚招校园兼职，手机点点就能赚，日入 300+，无需押金，先带你做一单看看效果～',
    },
    beats: [
      {
        id: 'b1',
        speaker: 'agent',
        channel: 'text',
        content: '先拉你进任务群，第一单很简单：给指定商品点赞，做完截图发我，立返 5 元。',
        options: [
          { label: '警惕“轻松日入”，先了解清楚', next: 'b2_ask', score: { fundSafety: 10 } },
          { label: '试试看，做一单小额任务', next: 'b2_bait', score: { fundSafety: -5 } },
          { label: '拒绝并举报', trigger: 'block' },
        ],
        next: 'b2_ask',
      },
      {
        id: 'b2_bait',
        speaker: 'agent',
        channel: 'text',
        content: '已收到你的 5 元返利啦，对吧？接下来是“垫付单”：先垫 300 元，做完返 360 元，净赚 60！',
        options: [
          { label: '意识到“先垫资”是套路，拒绝', next: 'b3_truth', score: { fundSafety: 30 } },
          { label: '先垫 300 元试试', trigger: 'transfer' },
        ],
        next: 'b3_truth',
      },
      {
        id: 'b2_ask',
        speaker: 'agent',
        channel: 'text',
        content: '我们是有正规营业执照的公司，群里几百号人都在做，今天做满 3 单还有额外奖励，错过就没啦！',
        options: [
          { label: '要求对方出示公司资质并自行核验', next: 'b3_truth', score: { identityCheck: 25 } },
          { label: '先垫资做一单', trigger: 'transfer' },
        ],
        next: 'b3_truth',
      },
      {
        id: 'b3_truth',
        speaker: 'system',
        channel: 'system',
        content:
          '你发现：所谓“公司”查无工商登记，刷单本身违规，且“先垫资返利”是典型诈骗套路——前期小额返利是诱饵，大额垫资后即被拉黑。',
        options: [
          { label: '拨打 110 报警', trigger: 'report' },
          { label: '拉黑举报', trigger: 'block' },
        ],
      },
    ],
    endings: {
      victim: { title: '被骗', description: '垫付大额资金后，对方失联，本金无法追回。' },
      defended: {
        title: '成功识破',
        description: '识破“垫资返利”刷单套路，拒绝转账并举报。',
      },
    },
    triggers: {
      transfer: { label: '垫资转账', ending: 'victim', dimension: 'fundSafety', delta: -60 },
      report: { label: '拨打110报警', ending: 'defended', dimension: 'emergencyResponse', delta: 40 },
      block: { label: '拉黑举报', ending: 'defended', dimension: 'emergencyResponse', delta: 30 },
    },
  },
];
