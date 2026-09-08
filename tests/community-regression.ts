import {createApp, h, reactive} from 'vue'
import {createPinia} from 'pinia'
import CommunityDialog from '../src/components/blog/BlogCommunityDialog.vue'
import Feedback from '../src/components/blog/CommunityFeedbackChatRoom.vue'
import Message from '../src/components/blog/CommunityMessageBubble.vue'
import {renderCommunityMarkdown} from '../src/lib/community-markdown'
import {loadEmojiManifest} from '../src/lib/community-emojis'
import '../src/styles/index.css'

const stamp='2026-09-08T00:00:00Z'
const comment=(id:number,content:string)=>({id,page:'about' as const,parent_id:null,root_id:id,nickname:'测试访客',website:'',content,created_at:stamp,status:'published' as const,author_key:'test',owned:false,is_admin:false,reply_to_name:''})
const topic={id:1,title:'反馈交互回归',kind:'bug' as const,status:'open' as const,nickname:'测试访客',website:'',owned:false,is_admin:false,author_key:'test',created_at:stamp,updated_at:stamp,resolution_note:'',merged_into_id:null,messages:[{...comment(100,'[@文章](https://blog.tonks.top/posts/writing-guide/)'),topic_id:1}],sources:[],events:[]}
const state=reactive({messages:Array.from({length:25},(_,i)=>({...comment(i+1,`测试消息 ${i+1}`),topic_id:null})),topics:[topic],parent:comment(500,':bilibili:daa338aa1dc86707:'),loading:false})
const surface=new URLSearchParams(location.search).get('surface')
const app=createApp({render:()=>surface==='dialog' ? h(CommunityDialog,{open:true}) : surface==='reply'
  ? h(Message,{comment:{...comment(501,'这是一条用于验证回复摘要订阅的足够长的回复内容'),parent_id:500},parent:state.parent,adminMode:false,selected:false})
  : h(Feedback,{messages:state.messages,topics:state.topics,loading:state.loading,identity:{nickname:'测试访客',email:'test@example.test',website:''},adminMode:false,adminSecret:''})})
document.getElementById('app')!.style.cssText='height:100vh;min-height:0;display:grid;grid-template-rows:minmax(0,1fr);overflow:hidden'
app.use(createPinia());app.mount('#app')
Object.assign(window,{communityTest:{state,renderCommunityMarkdown,loadEmojiManifest,unmount:()=>app.unmount()}})
